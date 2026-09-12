import { GatewayClient } from "@circle-fin/x402-batching/client";

async function main() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is missing in .env");
  }

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey,
  });

  console.log("Querying Circle Gateway balances for:", client.address);
  const b = await client.getBalances();
  console.log({
    walletAddress: client.address,
    walletBalanceUSDC: b.wallet.formatted,
    gatewayAvailableUSDC: b.gateway.formattedAvailable,
    gatewayTotalUSDC: b.gateway.formattedTotal,
  });
}

main().catch(console.error);
