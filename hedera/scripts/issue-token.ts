/**
 * Issue a spending mandate from the command line.
 *
 * In the product a human does this in the browser: verify with World, choose a
 * cap, get a token for their agent. This is the same act for someone who
 * already holds the app's signing secret - which is to say, someone who *is*
 * the app. It exists so the rail can be demonstrated without driving a World
 * proof through a browser first.
 *
 * The signing here mirrors web/src/lib/agentToken.ts deliberately rather than
 * importing it: that module pulls in next/server, which has no business in a
 * CLI. If the claim shape there changes, change it here too.
 *
 *   npm run hedera:issue-token -- <humanNullifier> [capUsd] [days]
 */
import crypto from "node:crypto";

const [human, cap = "0.50", days = "7"] = process.argv.slice(2);

if (!human || !human.startsWith("0x")) {
  console.error("usage: npm run hedera:issue-token -- <humanNullifier 0x…> [capUsd] [days]");
  process.exit(1);
}

const secret = process.env.FLOAT_SESSION_SECRET;
if (!secret || secret.length < 32) {
  console.error("FLOAT_SESSION_SECRET must be set (32+ chars) and match the web app's.");
  process.exit(1);
}

const exp = Math.floor(Date.now() / 1000) + Math.round(Number(days) * 86400);
const payload = Buffer.from(
  JSON.stringify({ typ: "agent", n: human, cap: Number(cap), lbl: "cli-agent", exp }),
  "utf8"
).toString("base64url");
const mac = crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(payload).digest("base64url");

console.log(`\nMandate for ${human.slice(0, 18)}…`);
console.log(`  cap     ${Number(cap).toFixed(2)} USDC`);
console.log(`  expires ${new Date(exp * 1000).toISOString()}\n`);
console.log(`FLOAT_AGENT_TOKEN=${payload}.${mac}\n`);
console.log(`Add that to .env. The agent then spends within the cap without asking again.`);
