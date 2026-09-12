import { GatewayClient } from "@circle-fin/x402-batching/client";

const client = new GatewayClient({
  chain: "arcTestnet",
  privateKey: (process.env.PRIVATE_KEY || process.env.FLOAT_FUNDING_PRIVATE_KEY || process.env.AGENT_PRIVATE_KEY) as `0x${string}`,
});

async function main() {
  console.log("getGatewayBalance source:\n", client.getGatewayBalance.toString());
  const balance = await client.getGatewayBalance("0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF");
  console.log("Arbitrary address balance:", balance);
}

main().catch(console.error);
