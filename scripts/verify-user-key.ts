import { privateKeyToAccount } from "viem/accounts";
import { GatewayClient } from "@circle-fin/x402-batching/client";

async function main() {
  const pk = "0x5c8735782703c56840481cd9c77bb9764dcb29f5e5250df37cbd12ae84b897a8" as `0x${string}`;
  const acc = privateKeyToAccount(pk);
  console.log("Account address:", acc.address);

  const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk });
  const b = await client.getBalances();
  console.log("Gateway available USDC:", b.gateway.formattedAvailable);
  console.log("Wallet balance USDC:", b.wallet.formatted);
}

main().catch(console.error);
