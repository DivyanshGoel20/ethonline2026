import { createPublicClient, http, parseAbiItem } from "viem";
import { arcTestnetChain, FLOAT_CREDIT_FACILITY_ABI } from "../web/src/lib/facilityContract";

const CONTRACT_ADDRESS = "0xAa2d23bAC7b6f9b4ca2737252F924b3F485E0686";

const agentTypo = "0x36e217970fa654ef640ee15e3bd734e946c077d";
const agentReal = "0x36e271970fa654ef640ee150e3bd734e946c077d";

const client = createPublicClient({
  chain: arcTestnetChain,
  transport: http("https://rpc.testnet.arc.network"),
});

async function main() {
  console.log("=== Querying FloatCreditFacility on Arc Testnet ===");
  console.log("Contract Address:", CONTRACT_ADDRESS);

  const owner = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: [parseAbiItem("function owner() view returns (address)")],
    functionName: "owner",
  });
  console.log("Contract Owner:", owner);

  const nativeBal = await client.getBalance({ address: owner as `0x${string}` });
  console.log("Owner Native Gas Balance (ARC):", (Number(nativeBal) / 1e18).toFixed(6), "ARC");

  const profileCount = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "getProfileCount",
  });
  console.log("Total On-Chain Profiles Count:", profileCount.toString());

  // Check agentAuthorizations for both address variations
  for (const addr of [agentReal, agentTypo]) {
    try {
      const auth = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: [
          parseAbiItem(
            "function agentAuthorizations(address) view returns (bytes32 profileId, bool isActive, uint256 authorizedAt)"
          ),
        ],
        functionName: "agentAuthorizations",
        args: [addr as `0x${string}`],
      });

      console.log(`\nAddress: ${addr}`);
      console.log("  Profile ID:   ", auth[0]);
      console.log("  Is Active:    ", auth[1]);
      console.log("  Authorized At:", auth[2].toString());

      const isAuthorized = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "isAgentAuthorized",
        args: [auth[0], addr as `0x${string}`],
      });
      console.log("  isAgentAuthorized:", isAuthorized);

      const remainingCredit = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "getRemainingCredit",
        args: [auth[0]],
      });
      console.log("  Remaining Credit:", remainingCredit.toString());

      const outstandingDebt = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "getOutstandingDebt",
        args: [auth[0]],
      });
      console.log("  Outstanding Debt:", outstandingDebt.toString());
    } catch (e: any) {
      console.log(`Error checking ${addr}:`, e.message);
    }
  }

  // Let's also check ArcScan explorer API or transaction count
  const txCount = await client.getTransactionCount({
    address: CONTRACT_ADDRESS,
  });
  console.log("\nContract Outgoing Nonce / Tx Count:", txCount);
}

main().catch(console.error);
