/**
 * Float, as a tool an AI agent can actually reach for.
 *
 * The rail already knows how to buy something on Hedera. What it did not have
 * was a way for a general-purpose agent - a Claude Code session, say - to be
 * handed a wallet and just get on with it. This is that: an MCP server whose
 * tools look, to the agent, like "fetch this thing" and "what do I owe".
 *
 * The wallet it runs as is deliberately empty. Zero USDC, and zero HBAR too,
 * because Blocky402 is the fee payer on every settlement - so the agent never
 * needs gas either. An account that holds nothing cannot self-fund a single
 * call, which means every purchase it makes is Float extending credit and then
 * parking a dated repayment on consensus. That is the demo: the agent does not
 * know or care that it is broke.
 *
 * One structural detail worth naming. MCP speaks JSON-RPC over stdout, and the
 * payer this wraps logs its progress to stdout as any CLI would. Left alone,
 * the first "quote 0.005 USDC" line corrupts the protocol frame and the client
 * drops the connection. So console.log is rebound to stderr before the payer is
 * ever called - the operator still sees the trace, the transport stays clean.
 */
console.log = (...args: unknown[]) => console.error(...args);

/**
 * Run as the empty wallet without disturbing the funded one the demo scripts
 * use. `agent()` reads process.env when it is called, so redirecting these two
 * here is enough - no argument has to be threaded through the payer, and no key
 * goes anywhere near .mcp.json, which is committed.
 */
if (process.env.FLOAT_MCP_AGENT_ID && process.env.FLOAT_MCP_AGENT_KEY) {
  process.env.HEDERA_AGENT_ID = process.env.FLOAT_MCP_AGENT_ID;
  process.env.HEDERA_AGENT_KEY = process.env.FLOAT_MCP_AGENT_KEY;
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { payForResource } from "../agent/payer";
import { agent, fromUnits, hashscanAccount, hashscanSchedule, hashscanTx } from "../src/config";
import { usdcBalance } from "../src/mirror";

const FEED = process.env.FLOAT_FEED_URL || "http://localhost:4021";

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

const server = new McpServer({ name: "float", version: "1.0.0" });

server.registerTool(
  "float_wallet",
  {
    title: "Check this agent's wallet",
    description:
      "Report the agent's Hedera account and its USDC balance. An empty wallet is not an error - " +
      "Float covers what the agent cannot, so purchases still go through.",
    inputSchema: {},
  },
  async () => {
    const me = agent();
    const balance = await usdcBalance(me.id);
    return text(
      [
        `account  ${me.id}`,
        `balance  ${fromUnits(balance)} USDC`,
        `         ${hashscanAccount(me.id)}`,
        balance === 0n
          ? `\nThis wallet is empty. Anything you buy will be funded by Float as credit,`
          : `\nEnough for small purchases; larger ones draw on Float.`,
        balance === 0n ? `and a dated repayment is parked on Hedera before the money moves.` : ``,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
);

server.registerTool(
  "float_catalogue",
  {
    title: "See what is for sale",
    description:
      "List the paid data the Float Risk Feed offers and what it costs. Free to call - " +
      "it is the unpaid side of the x402 endpoint.",
    inputSchema: {},
  },
  async () => {
    const res = await fetch(`${FEED}/catalog`);
    if (!res.ok) throw new Error(`feed returned ${res.status}; is it running? (npm run hedera:service)`);
    const c = (await res.json()) as any;
    return text(
      [
        `Float Risk Feed - credit-risk scores for autonomous agents`,
        `  ${c.records} records available`,
        `  ${c.pricePerRecord} per record, priced per call rather than per seat`,
        `  settles in USDC on ${c.network}, paid to ${c.payTo}`,
        ``,
        `Buy some with float_fetch, e.g. records=5.`,
      ].join("\n")
    );
  }
);

server.registerTool(
  "float_fetch",
  {
    title: "Buy data, on credit if needed",
    description:
      "Fetch a paid x402 resource. If the agent's wallet cannot cover the price, Float extends " +
      "credit: it parks a dated repayment on Hedera first, then settles the invoice. Returns the " +
      "data along with who paid for it.",
    inputSchema: {
      records: z.number().int().min(1).max(25).optional()
        .describe("How many risk records to buy. Price scales with this."),
      url: z.string().optional()
        .describe("A specific x402 resource URL. Defaults to the risk feed."),
      maxCreditUsd: z.number().optional()
        .describe("Cap on how much credit Float may extend for this call."),
    },
  },
  async ({ records, url, maxCreditUsd }) => {
    const target = url ?? `${FEED}/risk?records=${records ?? 1}`;
    const receipt = await payForResource(target, maxCreditUsd !== undefined ? { maxCreditUsd } : undefined);

    const lines = [
      receipt.fundedBy === "float-credit"
        ? `Paid ${receipt.amount} USDC — the wallet was short, so Float covered it on credit.`
        : `Paid ${receipt.amount} USDC from the agent's own balance.`,
    ];

    if (receipt.transactionId) lines.push(`  settlement  ${hashscanTx(receipt.transactionId)}`);

    if (receipt.scheduledRepayment) {
      const s = receipt.scheduledRepayment;
      lines.push(
        `  repayment   ${s.amount} USDC due ${s.dueAt}`,
        `              schedule ${s.scheduleId}`,
        `              ${hashscanSchedule(s.scheduleId)}`,
        ``,
        `That repayment was parked on consensus before the invoice was paid, and it`,
        `executes on its own at the due date. Nobody has to be online for it.`
      );
    }

    lines.push(``, `Data:`, JSON.stringify(receipt.data, null, 2));
    return text(lines.join("\n"));
  }
);

async function main() {
  await server.connect(new StdioServerTransport());
  console.error(`[float-mcp] ready as ${agent().id}, feed ${FEED}`);
}

main().catch((err) => {
  console.error("[float-mcp] failed:", err?.message || err);
  process.exit(1);
});
