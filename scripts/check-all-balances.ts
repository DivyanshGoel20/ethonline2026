import { GatewayClient } from "@circle-fin/x402-batching/client";

async function main() {
  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
  });

  const addresses = [
    { label: "User Rabby/Funded Wallet", address: "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3" },
    { label: "Agent in agents.json (Funded Agent)", address: "0xb534cb4a6e08faad83541883d366c0971ddf66be" },
    { label: "Agent (Unfunded Agent)", address: "0x36e271970fa654ef640ee150e3bd734e946c077d" },
    { label: "Float Facility (0x01)", address: "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf" },
  ];

  console.log("Checking live Circle Gateway balances on Arc Testnet...\n");
  for (const item of addresses) {
    try {
      const balance = await (client as any).getGatewayBalance(item.address);
      console.log(`${item.label} (${item.address}):`);
      console.log(`  - Gateway Available: ${balance.formattedAvailable} USDC`);
      console.log(`  - Raw: ${balance.available.toString()}\n`);
    } catch (err: any) {
      console.log(`${item.label} (${item.address}): Error - ${err.message}\n`);
    }
  }
}

main().catch(console.error);
