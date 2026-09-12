import { GatewayClient } from "@circle-fin/x402-batching/client";

async function main() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;

  if (!privateKey) {
    throw new Error("PRIVATE_KEY is missing. Make sure your .env file has PRIVATE_KEY=0x...");
  }

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey,
  });

  console.log("Wallet:", client.address);

  console.log("\nChecking current balances...");
  const before = await client.getBalances();

  console.log("Before:");
  console.log("Wallet USDC:", before.wallet.formatted);
  console.log("Gateway available:", before.gateway.formattedAvailable);

  console.log("\nDepositing 10 USDC to Circle Gateway...");

  const result = await client.deposit("10");

  console.log("\nDeposit successful!");
  console.log("Deposit TX Hash:", result.depositTxHash);

  console.log("\nChecking updated balances...");
  const after = await client.getBalances();

  console.log("After:");
  console.log("Wallet USDC:", after.wallet.formatted);
  console.log("Gateway available:", after.gateway.formattedAvailable);
}

main().catch((err) => {
  console.error("\nError executing deposit:", err.message || err);
  process.exit(1);
});