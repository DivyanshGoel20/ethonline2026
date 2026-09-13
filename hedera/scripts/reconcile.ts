/**
 * Reconcile every human's rail debt against what Hedera actually did.
 *
 * The per-human version lives behind the app; this is the operator's sweep, for
 * a cron. Parked repayments execute unattended, so without something running on
 * a timer the books only ever close for humans who happen to open the app.
 *
 *   npm run hedera:reconcile
 */
import { reconcileRailDebt } from "../../web/src/lib/reconcile";

async function main() {
  const r = await reconcileRailDebt();
  console.log(`  checked      ${r.checked} parked repayment(s)`);
  console.log(`  settled      ${r.settled.length}`);
  for (const d of r.settled) console.log(`    ${d.scheduleId}  ${d.amountUsd} USDC  headroom returned`);
  console.log(`  defaulted    ${r.defaulted.length}`);
  for (const d of r.defaulted) console.log(`    ${d.scheduleId}  ${d.amountUsd} USDC  ${d.defaultReason} - still owed`);
  console.log(`  not yet due  ${r.stillPending}`);
  for (const u of r.unresolved) console.log(`  unresolved   ${u.scheduleId}: ${u.reason}`);
}

main().catch((err) => {
  console.error("reconcile failed:", err?.message || err);
  process.exit(1);
});
