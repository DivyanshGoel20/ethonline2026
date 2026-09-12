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
  await check("Key 1", "0x0000000000000000000000000000000000000000000000000000000000000001");
  await check("Key 2", "0x0000000000000000000000000000000000000000000000000000000000000002");
}

main();
