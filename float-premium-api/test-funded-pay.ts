import { GatewayClient } from "@circle-fin/x402-batching/client";

async function testPay() {
  const privateKey = (process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;
  if (!privateKey) throw new Error("Missing AGENT_PRIVATE_KEY or PRIVATE_KEY in environment");

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey,
  });

  console.log("Testing live payment from funded account:", client.address);
  const result = await client.pay("http://localhost:3000/premium-data");
  console.log("PAYMENT RESULT:", result);
}

testPay().catch(console.error);
