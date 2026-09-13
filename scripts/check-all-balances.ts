/**
 * What an address or agent actually holds.
 *
 * Float runs on two rails and "balance" means a different thing on each, so
 * this takes either kind of identifier and asks the right question:
 *
 *   0x…    an Arc address        -> Circle Gateway available balance
 *   0.0.x  a Hedera account      -> USDC held, read from the Mirror Node
 *
 * With no argument it reports every agent Float knows about, on both rails.
 *
 *   npm run balances
 *   npm run balances -- 0x36e271970fa654ef640ee150e3bd734e946c077d
 *   npm run balances -- 0.0.10522706
 */
import fs from "node:fs";
import path from "node:path";

const isHedera = (s: string) => /^\d+\.\d+\.\d+$/.test(s);
const isEvm = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);

/** The Arc keys live in web/.env; this script runs from the repo root. */
function loadWebEnv() {
  const p = path.resolve(process.cwd(), "web", ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...rest] = t.split("=");
    if (!process.env[k]) process.env[k] = rest.join("=");
  }
}

async function gatewayBalance(address: string): Promise<string> {
  const { GatewayClient } = await import("@circle-fin/x402-batching/client");
  const pk = (process.env.PRIVATE_KEY || process.env.FLOAT_FUNDING_PRIVATE_KEY) as `0x${string}`;
  if (!pk) throw new Error("no PRIVATE_KEY or FLOAT_FUNDING_PRIVATE_KEY (looked in .env and web/.env)");

  const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk });
  const b = await (client as any).getGatewayBalance(address);
  return `${b.formattedAvailable} USDC`;
}

async function hederaBalance(accountId: string): Promise<string> {
  const { usdcBalance } = await import("../hedera/src/mirror");
  const { fromUnits } = await import("../hedera/src/config");
  return `${fromUnits(await usdcBalance(accountId))} USDC`;
}

function knownAgents(): { label: string; id: string; rail: "arc" | "hedera" }[] {
  const out: { label: string; id: string; rail: "arc" | "hedera" }[] = [];

  const arcPath = path.resolve(process.cwd(), "web", "data", "agents.json");
  if (fs.existsSync(arcPath)) {
    const raw = JSON.parse(fs.readFileSync(arcPath, "utf8"));
    for (const a of Array.isArray(raw) ? raw : raw.agents ?? []) {
      out.push({ label: a.name || "arc agent", id: a.address, rail: "arc" });
    }
  }

  const hedPath = path.resolve(process.cwd(), "hedera", "data", "agent-wallets.json");
  if (fs.existsSync(hedPath)) {
    for (const w of JSON.parse(fs.readFileSync(hedPath, "utf8"))) {
      out.push({ label: w.label || "hedera agent", id: w.id, rail: "hedera" });
    }
  }

  const mcp = process.env.FLOAT_MCP_AGENT_ID;
  if (mcp && !out.some((o) => o.id === mcp)) {
    out.push({ label: "mcp agent", id: mcp, rail: "hedera" });
  }
  return out;
}

async function report(label: string, id: string, rail: "arc" | "hedera") {
  try {
    const bal = rail === "arc" ? await gatewayBalance(id) : await hederaBalance(id);
    console.log(`  ${label.padEnd(22)} ${id.padEnd(44)} ${bal}`);
  } catch (err: any) {
    console.log(`  ${label.padEnd(22)} ${id.padEnd(44)} ${err?.message ?? err}`);
  }
}

async function main() {
  loadWebEnv();
  const arg = process.argv[2];

  if (arg) {
    if (isEvm(arg)) {
      console.log(`\nCircle Gateway, Arc testnet\n`);
      await report("address", arg, "arc");
    } else if (isHedera(arg)) {
      console.log(`\nUSDC on Hedera testnet\n`);
      await report("account", arg, "hedera");
    } else {
      console.error(`Not an address I recognise: ${arg}`);
      console.error(`Want 0x… for Arc, or 0.0.x for Hedera.`);
      process.exit(1);
    }
    console.log("");
    return;
  }

  const agents = knownAgents();
  if (!agents.length) {
    console.log("\nNo agents on file yet. Pass an address to check one directly.\n");
    return;
  }

  const arc = agents.filter((a) => a.rail === "arc");
  const hed = agents.filter((a) => a.rail === "hedera");

  if (arc.length) {
    console.log(`\nArc — Circle Gateway available\n`);
    for (const a of arc) await report(a.label, a.id, "arc");
  }
  if (hed.length) {
    console.log(`\nHedera — USDC held\n`);
    for (const a of hed) await report(a.label, a.id, "hedera");
  }
  console.log("");
}

main().catch((err) => {
  console.error("failed:", err?.message || err);
  process.exit(1);
});
