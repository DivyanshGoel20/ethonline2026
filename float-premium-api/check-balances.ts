import { GatewayClient } from "@circle-fin/x402-batching/client";

// Let's check the seller wallet address: 0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3
console.log("Checking Gateway balances for various addresses...");

async function check(name: string, pk: string) {
  try {
    const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk as any });
    const b = await client.getBalances();
    console.log(`${name} (${client.address}):`, {
      gatewayAvailable: b.gateway.formattedAvailable,
      walletBalance: b.wallet.formatted,
    });
  } catch (e: any) {
    console.log(`Error checking ${name}:`, e.message);
  }
}

async function main() {
  const pk1 = process.env.PRIVATE_KEY || process.env.FLOAT_FUNDING_PRIVATE_KEY;
  const pk2 = process.env.AGENT_PRIVATE_KEY;
  if (pk1) await check("Operator Wallet", pk1);
  if (pk2) await check("Agent Wallet", pk2);
}

main();
