import { GatewayClient } from "@circle-fin/x402-batching/client";

const client = new GatewayClient({
  chain: "arcTestnet",
  privateKey: "0x0000000000000000000000000000000000000000000000000000000000000002",
});

async function main() {
  try {
    const res = await client.pay("http://localhost:3000/premium-data");
    console.log("Pay success:", res);
  } catch (err: any) {
    console.log("Pay threw expected error:", err.message);
  }
}

main();
