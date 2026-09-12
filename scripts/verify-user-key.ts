import { privateKeyToAccount } from "viem/accounts";
import { GatewayClient } from "@circle-fin/x402-batching/client";

async function main() {
  const pk = (process.env.PRIVATE_KEY || process.env.FLOAT_FUNDING_PRIVATE_KEY) as `0x${string}`;
  if (!pk) throw new Error("Missing PRIVATE_KEY in environment");
  const acc = privateKeyToAccount(pk);
  console.log("Account address:", acc.address);

  const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk });
  const b = await client.getBalances();
  console.log("Gateway available USDC:", b.gateway.formattedAvailable);
  console.log("Wallet balance USDC:", b.wallet.formatted);
}

main().catch(console.error);
