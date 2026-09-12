import { FloatSignerTS } from "../web/src/lib/floatSigner";

/**
 * CLI script to execute real x402 payment on behalf of an agent with $0.00 Circle Gateway balance.
 * Float autonomously provides overdraft purchasing capacity from its funded Arc Testnet facility.
 */
async function main() {
  const targetAgent =
    process.argv[2] || "0x36e271970fa654ef640ee150e3bd734e946c077d";
  const targetUrl = process.argv[3] || "http://localhost:3000/premium-data";

  console.log("==================================================");
  console.log("⚡ Float x402 Autonomous Payment Overdraft");
  console.log("==================================================");
  console.log("Agent Address:          ", targetAgent);
  console.log("Target Resource URL:    ", targetUrl);

  const signer = new FloatSignerTS();

  console.log("Float Facility Payer:   ", signer.fundingAddress);

  // 1. Check agent's real Circle Gateway balance
  const balance = await signer.getAgentGatewayBalance(targetAgent);
  console.log("Agent Gateway Balance:  ", balance.formattedAvailable, "USDC");

  if (parseFloat(balance.formattedAvailable) === 0) {
    console.log("⚠️  Agent has 0 Gateway balance. Float Overdraft will activate!");
  }

  // 2. Execute x402 payment
  console.log("\n🚀 Initiating x402 payment request...");
  const startTime = Date.now();
  const result = await signer.pay(targetUrl, {
    agentAddress: targetAgent,
  });
  const durationMs = Date.now() - startTime;

  console.log("\n==================================================");
  console.log("🎉 Payment Result Summary");
  console.log("==================================================");
  console.log("Success:                ", result.success);
  console.log("HTTP Status:            ", result.status);
  console.log("Funding Source:         ", result.fundingSource);
  console.log("Requested Amount:       ", result.amount, "USDC");
  console.log("Overdraft Shortfall:    ", result.borrowed, "USDC");
  console.log("Drawdown ID:            ", result.drawdownId);
  console.log("Arc Testnet Tx Hash:    ", result.arcTxHash || "N/A");
  console.log("ArcScan Explorer:       ", result.arcTxLink || "N/A");
  console.log("Circle Settlement ID:   ", result.circleSettlementId || "N/A");
  console.log("Execution Time:         ", `${durationMs}ms`);
  console.log("Updated Agent Debt:     ", `${result.agentDebt} USDC`);
  console.log("\n📦 Unlocked API Response Payload:");
  console.log(JSON.stringify(result.data, null, 2));
  console.log("==================================================");
}

main().catch((err) => {
  console.error("\n❌ Payment failed:", err.message || err);
  process.exit(1);
});
