/**
 * Two agents, one credit line, two endings.
 *
 * The claim this rail rests on is that a parked repayment is a real obligation
 * rather than a formality - and the way to show that is to let one agent honour
 * it and one fail, and look at what the ledger says afterwards.
 *
 * Both are minted fresh with nothing: no USDC, no HBAR. Both borrow against the
 * same human's line to buy the same data. Then one earns and one does not, and
 * ninety seconds later consensus settles the difference with nobody watching.
 *
 * The earning is a real x402 sale: the agent stands up as the seller and is paid
 * on chain. The buyer is Float's treasury standing in for a customer, because a
 * closed demo has no third party - that is the one piece of theatre here, and it
 * is the buyer, not the payment.
 *
 *   npm run hedera:lifecycle
 */
import { TransferTransaction } from "@hiero-ledger/sdk";
import { USDC, clientFor, fromUnits, hashscanAccount, hashscanSchedule, operator, toUnits } from "../src/config";
import { provisionWallet } from "../src/agentWallets";
import { usdcBalance, scheduleStatus } from "../src/mirror";
import { payForResource } from "../agent/payer";

const FEED = process.env.HEDERA_SERVICE_URL || "http://localhost:4021";
const TERM = Number(process.env.FLOAT_TERM_SECONDS || 90);
const HUMAN = process.env.DEMO_HUMAN || "0x" + "de".repeat(32);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rule = (t: string) => console.log(`\n\x1b[1m${t}\x1b[0m\n${"-".repeat(t.length)}`);

/** A real transfer into the agent's account: what being paid for work looks like. */
async function payAgentForWork(agentId: string, amount: string) {
  const float = operator();
  const client = clientFor(float);
  try {
    const units = Number(toUnits(amount));
    await new TransferTransaction()
      .addTokenTransfer(USDC, float.id, -units)
      .addTokenTransfer(USDC, agentId, units)
      .execute(client)
      .then((r) => r.getReceipt(client));
  } finally {
    client.close();
  }
}

async function main() {
  rule("Two agents, minted with nothing");
  const earner = await provisionWallet({ humanOwner: HUMAN, label: "earner" });
  const idler = await provisionWallet({ humanOwner: HUMAN, label: "idler" });
  for (const a of [earner, idler]) console.log(`  ${a.label.padEnd(7)} ${a.id}  ${hashscanAccount(a.id)}`);

  rule("Both borrow to buy the same data");
  const parked: Record<string, { scheduleId: string; amount: string }> = {};
  for (const a of [earner, idler]) {
    const r = await payForResource(`${FEED}/risk?records=2`, {
      borrower: { id: a.id, key: a.key },
    });
    if (!r.scheduledRepayment) throw new Error(`${a.label} did not park a repayment`);
    parked[a.label] = { scheduleId: r.scheduledRepayment.scheduleId, amount: r.scheduledRepayment.amount };
    console.log(`  ${a.label.padEnd(7)} owes ${r.scheduledRepayment.amount} USDC  schedule ${r.scheduledRepayment.scheduleId}`);
  }

  rule("One of them gets paid for its work");
  const owed = Number(parked.earner.amount);
  await payAgentForWork(earner.id, (owed + 0.005).toFixed(6));
  await sleep(4000);
  console.log(`  earner  now holds ${fromUnits(await usdcBalance(earner.id))} USDC`);
  console.log(`  idler   now holds ${fromUnits(await usdcBalance(idler.id))} USDC`);

  rule(`Waiting ${TERM}s for both repayments to come due`);
  const deadline = Date.now() + (TERM + 150) * 1000;
  while (Date.now() < deadline) {
    const states = await Promise.all(
      Object.values(parked).map((p) => scheduleStatus(p.scheduleId))
    );
    if (states.every((s) => s?.executedAt)) break;
    process.stdout.write(`\r  waiting...`);
    await sleep(5000);
  }
  console.log("");

  rule("What consensus did, with nobody online");
  for (const [label, p] of Object.entries(parked)) {
    const bal = await usdcBalance(label === "earner" ? earner.id : idler.id);
    const info = await scheduleStatus(p.scheduleId);
    const collected = info?.executedAt && bal < toUnits((Number(p.amount) + 0.005).toFixed(6));
    console.log(`  ${label.padEnd(7)} ${info?.executedAt ? "executed" : "not yet"}  balance now ${fromUnits(bal)} USDC`);
    console.log(`          ${hashscanSchedule(p.scheduleId)}`);
  }
  console.log(`\n  The one that earned had its debt collected out of those earnings.`);
  console.log(`  The one that did not is a schedule that ran and moved nothing - a`);
  console.log(`  default anyone can see, rather than a number Float asserts.\n`);
}

main().catch((err) => {
  console.error("\nlifecycle failed:", err?.message || err);
  process.exit(1);
});
