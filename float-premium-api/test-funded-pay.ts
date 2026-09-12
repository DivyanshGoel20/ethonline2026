import { GatewayClient } from "@circle-fin/x402-batching/client";

async function testPay() {
  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
  });

  console.log("Testing live payment from funded account:", client.address);
  const result = await client.pay("http://localhost:3000/premium-data");
  console.log("PAYMENT RESULT:", result);
}

testPay().catch(console.error);
