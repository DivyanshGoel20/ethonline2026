/**
 * Float from a shell, for agents that have one.
 *
 * The MCP server is the better fit when the agent speaks MCP; this is for
 * everything else - a Claude Code subagent with Bash, a cron job, a script
 * someone is debugging. Same payer underneath, same credit path.
 *
 *   npm run float:fetch -- --records 3
 *   npm run float:fetch -- --url http://localhost:4021/risk?records=5
 *   npm run float:fetch -- --wallet
 */
import { payForResource } from "./payer";
import { agent, fromUnits, hashscanSchedule, hashscanTx } from "../src/config";
import { usdcBalance } from "../src/mirror";
import { termsText } from "../src/terms";
import { AGENT_TOKEN, NO_MANDATE, describeMandate, payUnderMandate } from "../src/mandate";

const FEED = process.env.FLOAT_FEED_URL || "http://localhost:4021";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  // Same override the MCP server uses, so both run as the same empty wallet.
  if (process.env.FLOAT_MCP_AGENT_ID && process.env.FLOAT_MCP_AGENT_KEY) {
    process.env.HEDERA_AGENT_ID = process.env.FLOAT_MCP_AGENT_ID;
    process.env.HEDERA_AGENT_KEY = process.env.FLOAT_MCP_AGENT_KEY;
  }

  const me = agent();

  if (flag("wallet")) {
    const balance = await usdcBalance(me.id);
    console.log(`account ${me.id}`);
    console.log(`balance ${fromUnits(balance)} USDC`);
    if (balance === 0n) {
      console.log(`empty - it cannot fund a purchase on its own.`);
      console.log(`Float can cover the shortfall as credit, but only if you ask:`);
      console.log(`  --terms         read the terms`);
      console.log(`  --allow-credit  accept them. Nothing is borrowed until you do.`);
    }
    return;
  }

  if (flag("terms")) {
    console.log(termsText());
    return;
  }

  if (flag("mandate")) {
    const m = describeMandate();
    if (!m) { console.log(NO_MANDATE); process.exitCode = 1; return; }
    console.log(`mandate from human ${m.human.slice(0, 18)}…`);
    console.log(`  label   ${m.label}`);
    console.log(`  cap     ${m.capUsd.toFixed(2)} USDC`);
    console.log(`  expires ${m.expiresAt}`);
    return;
  }

  const url = arg("url") ?? `${FEED}/risk?records=${arg("records") ?? "1"}`;

  // No mandate, no spending. The agent is not asked to agree to credit terms -
  // its human already did, by issuing the token.
  if (!AGENT_TOKEN) {
    console.log(`\nNothing bought, no debt taken on.\n`);
    console.log(NO_MANDATE);
    process.exitCode = 1;
    return;
  }

  const r = await payUnderMandate(url);

  console.log(
    r.fundedBy === "float-credit"
      ? `\npaid ${r.amount} USDC on your human's credit line, under your mandate`
      : `\npaid ${r.amount} USDC from the agent's own balance`
  );
  if (r.transactionId) console.log(`settlement ${hashscanTx(r.transactionId)}`);
  if (r.scheduledRepayment) {
    console.log(`repayment  ${r.scheduledRepayment.amount} USDC due ${r.scheduledRepayment.dueAt}`);
    console.log(`           ${hashscanSchedule(r.scheduledRepayment.scheduleId)}`);
  }
  console.log(`\n${JSON.stringify(r.data, null, 2)}`);
}

main().catch((err) => {
  console.error("failed:", err?.message || err);
  process.exit(1);
});
