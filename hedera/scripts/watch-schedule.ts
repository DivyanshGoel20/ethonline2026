/**
 * Watches a parked repayment until the network executes it.
 *
 * The claim this whole rail rests on is that nobody has to be online when a
 * repayment falls due. That is worth checking rather than asserting, so: poll
 * the schedule and the borrower's balance, and show the transfer happening with
 * no party to it awake.
 *
 *   npm run hedera:watch -- 0.0.10509617
 */
import { fromUnits, hashscanSchedule, optionalTopicId } from "../src/config";
import { scheduleStatus, usdcBalance } from "../src/mirror";
import { append } from "../src/hcs";

const scheduleId = process.argv[2];
const borrower = process.env.HEDERA_BORROWER_ID!;
const TIMEOUT_MS = 5 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!scheduleId) throw new Error("usage: npm run hedera:watch -- <scheduleId>");

  const before = await usdcBalance(borrower);
  const start = Date.now();

  console.log(`  schedule ${scheduleId}  ${hashscanSchedule(scheduleId)}`);
  console.log(`  borrower ${borrower} holds ${fromUnits(before)} USDC`);

  const first = await scheduleStatus(scheduleId);
  if (!first) throw new Error(`no such schedule: ${scheduleId}`);
  console.log(`  due      ${first.expirationTime}`);

  // Already run before this watch began. Report it, but do not write a
  // repayment entry: the balances read now say nothing about what moved then,
  // and a trail entry for a transition nobody witnessed is worse than none.
  if (first.executedAt) {
    console.log(`\n  Already executed at ${first.executedAt}, before this watch started.`);
    console.log(`  Nothing to witness - see ${hashscanSchedule(scheduleId)} for the transfer.`);
    return;
  }
  if (first.deleted) {
    console.log(`\n  Already deleted - it will never execute.`);
    return;
  }
  console.log("");

  while (Date.now() - start < TIMEOUT_MS) {
    const info = await scheduleStatus(scheduleId);
    if (!info) throw new Error(`schedule ${scheduleId} vanished from the mirror`);
    const elapsed = Math.round((Date.now() - start) / 1000);

    if (info.executedAt) {
      // The mirror reflects the transfer a moment after the schedule flips.
      await sleep(3000);
      const after = await usdcBalance(borrower);
      const moved = before - after;
      console.log(`\n  EXECUTED at ${info.executedAt}`);
      console.log(`  borrower ${fromUnits(before)} -> ${fromUnits(after)} USDC  (moved ${fromUnits(moved)})`);
      console.log(`\n  Nothing triggered this. No key was held awake, no job ran.`);

      const topic = optionalTopicId();
      if (topic && moved > 0n) {
        try {
          await append(topic, {
            kind: "repayment",
            human: borrower,
            amount: fromUnits(moved),
            scheduleId,
          });
          console.log(`  repayment appended to the HCS trail`);
        } catch (err: any) {
          console.warn(`  trail write failed: ${err?.message || err}`);
        }
      }
      return;
    }

    if (info.deleted) {
      console.log(`\n  DELETED - it will never execute.`);
      return;
    }

    process.stdout.write(`\r  waiting... ${elapsed}s`);
    await sleep(5000);
  }

  console.log(`\n  still not executed after ${TIMEOUT_MS / 1000}s`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("\nfailed:", err?.message || err);
  process.exit(1);
});
