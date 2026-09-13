/**
 * Sets an account's USDC balance to a target, moving the difference to or from
 * the operator.
 *
 * The demo turns on the agent being able to afford a small call and not a large
 * one, so its balance has to sit in a narrow band - and every run shifts it.
 * Reach for this between runs rather than re-provisioning accounts.
 *
 *   npm run hedera:balance -- 0.02              # the agent
 *   npm run hedera:balance -- 3.00 borrower     # the human on the hook
 *
 * The borrower matters separately: it is the account a parked repayment draws
 * from on its date, and a borrower that cannot cover the total outstanding
 * defaults on the difference. The payer API's GET /schedules totals what is owed.
 */
import { TransferTransaction } from "@hiero-ledger/sdk";
import { USDC, agent, borrower, clientFor, fromUnits, operator, toUnits } from "../src/config";
import { usdcBalance } from "../src/mirror";

const TARGET = process.argv[2] || "0.02";
const WHO = (process.argv[3] || "agent").toLowerCase();

if (WHO !== "agent" && WHO !== "borrower") {
  console.error(`unknown account "${WHO}" - expected "agent" or "borrower"`);
  process.exit(1);
}

async function main() {
  const a = WHO === "borrower" ? borrower() : agent();
  const f = operator();
  const target = toUnits(TARGET);
  const balance = await usdcBalance(a.id);

  console.log(`  ${WHO.padEnd(8)} ${a.id}`);
  console.log(`  holds  ${fromUnits(balance)} USDC, target ${fromUnits(target)}`);

  if (balance === target) {
    console.log("  already there");
    return;
  }

  // Whoever is losing USDC signs, so the client is opened as that party.
  const surplus = balance > target;
  const delta = surplus ? balance - target : target - balance;
  const [from, to] = surplus ? [a, f] : [f, a];

  const client = clientFor(from);
  try {
    await new TransferTransaction()
      .addTokenTransfer(USDC, from.id, -Number(delta))
      .addTokenTransfer(USDC, to.id, Number(delta))
      .execute(client)
      .then((r) => r.getReceipt(client));
  } finally {
    client.close();
  }

  console.log(`  moved  ${fromUnits(delta)} ${surplus ? `${WHO} -> operator` : `operator -> ${WHO}`}`);

  // The mirror node lags consensus, so read back after a beat.
  await new Promise((r) => setTimeout(r, 3500));
  console.log(`  ${WHO} now holds ${fromUnits(await usdcBalance(a.id))} USDC`);
}

main().catch((err) => {
  console.error("failed:", err?.message || err);
  process.exit(1);
});
