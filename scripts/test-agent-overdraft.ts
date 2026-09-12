import { FloatSignerTS } from "../web/src/lib/floatSigner";

async function testAgentOverdraft() {
  const agentAddress = "0x36e271970fa654ef640ee150e3bd734e946c077d";
  const signer = new FloatSignerTS({
    fundingPrivateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
  });

  console.log("Agent:", agentAddress);
  console.log("Float Funding Address:", signer.fundingAddress);

  const balance = await signer.getAgentGatewayBalance(agentAddress);
  console.log("Agent Gateway available balance:", balance.formattedAvailable, "USDC");

  console.log("\nTriggering x402 payment to http://localhost:3000/premium-data via FloatSignerTS...");
  const result = await signer.pay("http://localhost:3000/premium-data", {
    agentAddress,
    humanProfileId: "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3",
  });

  console.log("\n=== Result ===");
  console.log("Success:", result.success);
  console.log("Funding Source:", result.fundingSource);
  console.log("Shortfall Covered:", result.borrowed, "USDC");
  console.log("Drawdown ID:", result.drawdownId);
  console.log("Transaction ID:", result.transactionId);
  console.log("API Response:", JSON.stringify(result.data));
  console.log("Agent Debt:", result.agentDebt, "USDC");
  console.log("Facility Debt:", result.facilityDebt, "USDC");
}

testAgentOverdraft().catch(console.error);
