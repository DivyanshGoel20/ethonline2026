/**
 * What a default actually looks like.
 *
 * Float's pitch is that a missed repayment is observable rather than asserted:
 * the parked transfer simply fails at maturity and anyone watching the schedule
 * can see it. That is a claim about behaviour nobody had checked, so this checks
 * it - a fresh account with no USDC, a repayment due in ninety seconds, and a
 * look at what consensus does when the clock runs out.
 *
 *   npm run hedera:probe-default
 */
import { AccountCreateTransaction, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { clientFor, hashscanSchedule, operator, type Identity } from "../src/config";
import { scheduleRepayment } from "../src/scheduled";
import { scheduleStatus, usdcBalance } from "../src/mirror";

const TERM = 90;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function emptyAccount(): Promise<Identity> {
  const client = clientFor(operator());
  try {
    const key = PrivateKey.generateECDSA();
    const receipt = await new AccountCreateTransaction()
      .setECDSAKeyWithAlias(key)
      .setInitialBalance(new Hbar(0))
      .setMaxAutomaticTokenAssociations(-1)
      .setAccountMemo("Float - default probe")
      .execute(client)
      .then((r) => r.getReceipt(client));
    return { id: receipt.accountId!.toString(), key: key.toStringRaw() };
  } finally {
    client.close();
  }
}

/** The mirror lags account creation by a few seconds; 404 here means "not yet". */
async function balanceWhenIndexed(id: string): Promise<bigint> {
  for (let i = 0; i < 12; i++) {
    try {
      return await usdcBalance(id);
    } catch (err: any) {
      if (!String(err?.message).includes("404")) throw err;
      await sleep(3000);
    }
  }
  throw new Error(`mirror never indexed ${id}`);
}

async function main() {
  const broke = await emptyAccount();
  console.log(`  borrower ${broke.id} holds ${await balanceWhenIndexed(broke.id)} USDC - nothing`);

  const s = await scheduleRepayment({
    borrower: broke,
    amount: "0.050000",
    dueInSeconds: TERM,
    memo: "Float default probe - borrower cannot pay",
  });
  console.log(`  parked   ${s.scheduleId}, 0.05 USDC due ${s.dueAt}`);
  console.log(`  ${hashscanSchedule(s.scheduleId)}\n`);

  const deadline = Date.now() + (TERM + 120) * 1000;
  while (Date.now() < deadline) {
    const info = await scheduleStatus(s.scheduleId);
    if (!info) {
      console.log("\n  schedule is gone from the mirror entirely");
      return;
    }
    if (info.executedAt) {
      const after = await balanceWhenIndexed(broke.id);
      console.log(`\n  schedule marked EXECUTED at ${info.executedAt}`);
      console.log(`  borrower balance after: ${after} USDC`);
      console.log(
        after === 0n
          ? `\n  So: consensus ran it, the transfer failed for want of funds, and the\n` +
              `  schedule is still stamped executed. The default is visible as a schedule\n` +
              `  that ran without moving anything - not as an error anyone has to report.`
          : `\n  Unexpected: the transfer moved funds from an account that had none.`
      );
      return;
    }
    if (info.deleted) {
      console.log("\n  schedule was deleted before maturity");
      return;
    }
    process.stdout.write(`\r  waiting for maturity...`);
    await sleep(5000);
  }
  console.log("\n  never resolved within the window");
}

main().catch((err) => {
  console.error("\nprobe failed:", err?.message || err);
  process.exit(1);
});
