/**
 * Accept an obligation Float proposed, using a key Float does not have.
 *
 * This is the borrower's half of a parked repayment. Float builds the schedule
 * - the amount, the date, who pays whom - but that schedule does nothing until
 * the account being debited signs it, and that signature can be sent from
 * anywhere by anyone holding the key. Float never sees it.
 *
 * Which is the point. Everywhere else "the borrower will repay on the 30th" is
 * either a lender holding the borrower's key, or an allowance the borrower can
 * revoke the moment the money lands. Here the borrower signs once, knowingly,
 * and then cannot take it back - and Float still never had the key.
 *
 *   npm run hedera:sign -- 0.0.12345 --key 0x...
 *   npm run hedera:sign -- 0.0.12345            # uses HEDERA_AGENT_KEY
 *
 * Inspect before signing: the schedule's memo, amount and date are public.
 */
import { accountPublicKey, hasSignature, inspect, signSchedule } from "../src/scheduled";
import { agent, hashscanSchedule } from "../src/config";

async function main() {
  const args = process.argv.slice(2);
  const scheduleId = args[0];
  if (!scheduleId || !/^\d+\.\d+\.\d+$/.test(scheduleId)) {
    throw new Error("usage: npm run hedera:sign -- <scheduleId> [--key 0x...]");
  }

  const keyIndex = args.indexOf("--key");
  const asIndex = args.indexOf("--as");
  const signer = {
    id: asIndex >= 0 ? args[asIndex + 1] : agent().id,
    key: keyIndex >= 0 ? args[keyIndex + 1] : agent().key,
  };

  // Read it before agreeing to it. Everything that matters about a schedule is
  // public before it executes, which is what makes signing an informed act
  // rather than a formality.
  const info = await inspect(scheduleId);
  console.log(`  schedule  ${scheduleId}`);
  console.log(`  memo      ${info.memo}`);
  console.log(`  due       ${info.expirationTime}`);
  console.log(`  waits     ${info.waitForExpiry}`);
  console.log(`  signing as ${signer.id}`);

  const pub = await accountPublicKey(signer.id);
  if (pub && (await hasSignature(scheduleId, pub))) {
    console.log(`\n  already signed by ${signer.id} - nothing to do`);
    return;
  }

  await signSchedule(scheduleId, signer);
  console.log(`\n  signed. The obligation is the network's to execute now.`);
  console.log(`  ${hashscanSchedule(scheduleId)}`);
}

main().catch((err) => {
  console.error("could not sign:", err?.message || err);
  process.exit(1);
});
