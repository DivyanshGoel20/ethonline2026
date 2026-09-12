import { GatewayClient } from "@circle-fin/x402-batching/client";

async function testPaySelf() {
  const pk = process.env.PRIVATE_KEY as `0x${string}`;
  const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk });

  console.log("Client address (payer):", client.address);
  try {
    const res = await client.pay("http://localhost:3000/premium-data");
    console.log("Pay success:", res);
  } catch (err: any) {
    console.log("Pay error:", err.message);
  }
}

testPaySelf();
