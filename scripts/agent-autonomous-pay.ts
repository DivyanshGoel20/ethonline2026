import { privateKeyToAccount } from "viem/accounts";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
if (!AGENT_PRIVATE_KEY) {
  console.error("❌ Error: Missing AGENT_PRIVATE_KEY in environment variables (.env)");
  process.exit(1);
}

const FLOAT_API_BASE = process.env.FLOAT_API_BASE || "http://localhost:3001";
const PREMIUM_API_URL = process.env.PREMIUM_API_URL || "http://localhost:3000/premium-data";

async function main() {
  const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
  const agentAddress = account.address;

  console.log("================================================================================");
  console.log("⚡ Autonomous AI Agent Signing & Overdraft Execution");
  console.log("================================================================================");
  console.log(`Agent Address:        ${agentAddress}`);
  console.log(`Float Server:         ${FLOAT_API_BASE}`);
  console.log(`Target x402 API:      ${PREMIUM_API_URL}`);
  console.log(`Network:              Arc Testnet (Chain ID 5042002)\n`);

  // Step 1: Check Circle Gateway balance
  let available = 0;
  try {
    const client = new GatewayClient({
      chain: "arcTestnet",
      privateKey: AGENT_PRIVATE_KEY,
    });

    const balance = await client.getBalances();
    console.log("1️⃣  Inspecting Agent's Circle Gateway Balance:");
    console.log(`   - Available in Gateway: $${balance.gateway.formattedAvailable} USDC`);
    console.log(`   - Liquid in Wallet:    $${balance.wallet.formatted} USDC`);
    available = parseFloat(balance.gateway.formattedAvailable || "0");
  } catch (err: any) {
    console.log("1️⃣  Inspecting Agent's Circle Gateway Balance:");
    console.log("   - Available in Gateway: $0.00 USDC (Fresh agent)");
  }

  if (available <= 0) {
    console.log("   ⚠️  Agent has $0 in Circle Gateway. Float Overdraft will activate on Arc Testnet!\n");
  } else {
    console.log("   ✓  Agent has sufficient balance. Agent will self-sign directly.\n");
  }

  // Step 2: Request the x402 protected resource
  console.log(`2️⃣  Requesting Protected Resource: GET ${PREMIUM_API_URL}...`);
  const initialRes = await fetch(PREMIUM_API_URL);

  if (initialRes.status !== 402) {
    console.log(`   Unexpected response: ${initialRes.status}`);
    const body = await initialRes.text();
    console.log(body);
    return;
  }

  console.log("   ✓  Received HTTP 402 Payment Required challenge from seller service.");

  // Step 3: Route payment through FloatSigner backend
  console.log("\n3️⃣  Routing through Float Autonomous Signer (/api/pay)...");
  const payRes = await fetch(`${FLOAT_API_BASE}/api/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: PREMIUM_API_URL,
      agentAddress,
      agentPrivateKey: AGENT_PRIVATE_KEY,
    }),
  });

  const payData = await payRes.json();

  if (!payRes.ok || !payData.success) {
    console.error("   ❌ Payment execution failed:", payData.error || payData);
    process.exit(1);
  }

  console.log("   🎉 Payment Settled Successfully!");
  console.log(`   - Funding Source:     ${payData.fundingSource}`);
  console.log(`   - Amount Requested:   $${payData.amount} USDC`);
  console.log(`   - Overdraft Drawn:    $${payData.borrowed} USDC`);
  console.log(`   - Payer Wallet:       ${payData.payer}`);

  if (payData.arcTxHash) {
    console.log(`\n🔗 Arc Testnet On-Chain Drawdown Transaction:`);
    console.log(`   Tx Hash:    ${payData.arcTxHash}`);
    console.log(`   ArcScan:    https://testnet.arcscan.app/tx/${payData.arcTxHash}`);
  }

  if (payData.circleSettlementId) {
    console.log(`   Circle Settle: ${payData.circleSettlementId}`);
  }

  console.log("\n📦 Unlocked API Response Payload:");
  console.log(JSON.stringify(payData.data, null, 2));

  console.log("\n================================================================================");
  console.log("✅ Agent autonomous payment complete! Real-time stream in dashboard updated.");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
