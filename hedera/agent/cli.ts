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
import { DEFAULT_CREDIT_CAP_USDC, preflight, termsText } from "../src/terms";

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
    if (balance === 0n) console.log(`empty - purchases will be funded by Float on credit`);
    return;
  }

  if (flag("terms")) {
    console.log(termsText());
    return;
  }

  const url = arg("url") ?? `${FEED}/risk?records=${arg("records") ?? "1"}`;
  const cap = Number(arg("max-credit") ?? DEFAULT_CREDIT_CAP_USDC);

  // Same consent gate the MCP tool applies: borrowing is opt-in, and bounded.
  const pre = await preflight(url, me.id, cap);

  if (pre?.needsCredit && !flag("allow-credit")) {
    console.log(`\nNothing bought, no debt taken on.`);
    console.log(`  price ${pre.priceUsdc} USDC, wallet ${pre.balanceUsdc} USDC, short ${pre.shortfallUsdc} USDC\n`);
    console.log(termsText(pre.shortfallUsdc));
    console.log(`\nRe-run with --allow-credit to accept these terms.`);
    process.exitCode = 1;
    return;
  }

  if (pre?.needsCredit && !pre.withinCap) {
    console.error(
      `\ndeclined: borrowing ${pre.shortfallUsdc} USDC exceeds the ${cap} USDC cap.` +
        `\nraise it with --max-credit if you mean to.`
    );
    process.exitCode = 1;
    return;
  }

  const receipt = await payForResource(url, { maxCreditUsd: cap });

  console.log(
    receipt.fundedBy === "float-credit"
      ? `\npaid ${receipt.amount} USDC on Float credit (authorised with --allow-credit)`
      : `\npaid ${receipt.amount} USDC from the agent's own balance`
  );
  if (receipt.transactionId) console.log(`settlement ${hashscanTx(receipt.transactionId)}`);
  if (receipt.scheduledRepayment) {
    const s = receipt.scheduledRepayment;
    console.log(`repayment  ${s.amount} USDC due ${s.dueAt}`);
    console.log(`           ${hashscanSchedule(s.scheduleId)}`);
  }
  console.log(`\n${JSON.stringify(receipt.data, null, 2)}`);
}

main().catch((err) => {
  console.error("failed:", err?.message || err);
  process.exit(1);
});
