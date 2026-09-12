/**
 * The whole Hedera rail, end to end.
 *
 *   terminal 1:  npm run hedera:service
 *   terminal 2:  npm run hedera:demo
 *
 * Two paid calls against the same metered endpoint. The first is small enough
 * that the agent covers it from its own balance. The second is priced past what
 * the agent holds, so Float parks a repayment on the network and settles the
 * invoice from treasury. Both land on the HCS trail.
 */
import { fromUnits, hashscanSchedule, hashscanTopic, hashscanTx, agent, optionalTopicId } from "../src/config";
import { usdcBalance } from "../src/mirror";
import { payForResource } from "../agent/payer";
import { read } from "../src/hcs";
import { inspect } from "../src/scheduled";

const BASE = process.env.HEDERA_SERVICE_URL || "http://localhost:4021";

const rule = (t: string) => console.log(`\n\x1b[1m${t}\x1b[0m\n${"-".repeat(t.length)}`);

async function main() {
  const buyer = agent();

  rule("Agent");
  console.log(`  account ${buyer.id}`);
  console.log(`  USDC    ${fromUnits(await usdcBalance(buyer.id))}`);

  const catalog = await fetch(`${BASE}/catalog`).then((r) => r.json());
  console.log(`  feed    ${catalog.records} records at ${catalog.pricePerRecord} each, paid to ${catalog.payTo}`);

  rule("1. A call the agent can afford");
  const small = await payForResource(`${BASE}/risk?records=1`);
  console.log(`  funded by ${small.fundedBy}, paid ${small.amount} USDC`);
  if (small.transactionId) console.log(`  ${hashscanTx(small.transactionId)}`);
  console.log(`  got ${(small.data as any)?.records?.length ?? 0} record(s)`);

  rule("2. A call it cannot - Float extends credit");
  const big = await payForResource(`${BASE}/risk?records=25`);
  console.log(`  funded by ${big.fundedBy}, paid ${big.amount} USDC`);
  if (big.transactionId) console.log(`  ${hashscanTx(big.transactionId)}`);
  console.log(`  got ${(big.data as any)?.records?.length ?? 0} record(s)`);

  if (big.scheduledRepayment) {
    const s = big.scheduledRepayment;
    rule("3. The repayment, already on the ledger");
    console.log(`  schedule  ${s.scheduleId}`);
    console.log(`  amount    ${s.amount} USDC`);
    console.log(`  due       ${s.dueAt}`);
    console.log(`  ${hashscanSchedule(s.scheduleId)}`);

    const info = await inspect(s.scheduleId);
    console.log(`  waitForExpiry ${info.waitForExpiry}   executed ${info.executed ?? "not yet"}`);
    console.log(`\n  Nobody has to be online when this falls due. Consensus executes it.`);
  }

  const topic = optionalTopicId();
  if (topic) {
    rule("4. The trail on HCS");
    console.log(`  ${hashscanTopic(topic)}`);
    // The mirror node lags consensus by a moment; a short wait avoids showing
    // an empty trail for entries that were written seconds ago.
    await new Promise((r) => setTimeout(r, 4000));
    for (const e of (await read(topic, 10)).reverse()) {
      console.log(`  #${e.sequenceNumber} ${e.kind.padEnd(9)} ${JSON.stringify({ ...e, kind: undefined, sequenceNumber: undefined, at: undefined })}`);
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error("\ndemo failed:", err?.message || err);
  process.exit(1);
});
