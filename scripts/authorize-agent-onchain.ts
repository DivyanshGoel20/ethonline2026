import { createWalletClient, createPublicClient, http, parseUnits, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnetChain, FLOAT_CREDIT_FACILITY_ABI } from "../web/src/lib/facilityContract";

const CONTRACT_ADDRESS = "0xAa2d23bAC7b6f9b4ca2737252F924b3F485E0686";
const AGENT_ADDRESS = "0x36e271970fa654ef640ee150e3bd734e946c077d";
const HUMAN_OWNER = "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3";

async function main() {
  const pk = process.env.PRIVATE_KEY as `0x${string}`;
  if (!pk) {
    throw new Error("PRIVATE_KEY missing in .env");
  }

  const account = privateKeyToAccount(pk);
  console.log("Broadcaster account (Owner):", account.address);

  const publicClient = createPublicClient({
    chain: arcTestnetChain,
    transport: http("https://rpc.testnet.arc.network"),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnetChain,
    transport: http("https://rpc.testnet.arc.network"),
  });

  const profileId = keccak256(encodePacked(["address"], [HUMAN_OWNER]));
  const humanRoot = keccak256(encodePacked(["string"], [process.env.HUMAN_ROOT || "0x1a4d7ff9847b6b4d616afa1e16ada2c29cf59e4357ce759a87320b539a1b8077"]));
  const creditLimit = parseUnits("500", 6); // $500.00 USDC

  console.log("\n1. Creating Credit Profile on Arc Testnet...");
  console.log("Profile ID:", profileId);
  console.log("Credit Limit: $500.00 USDC (500000000 units)");

  const createTx = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "createCreditProfile",
    args: [profileId, HUMAN_OWNER, humanRoot, creditLimit],
  });

  console.log("createCreditProfile TX submitted:", createTx);
  console.log("Waiting for confirmation on Arc Testnet...");
  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
  console.log("Confirmed in Block:", createReceipt.blockNumber.toString());

  console.log(`\n2. Authorizing Agent ${AGENT_ADDRESS} on Arc Testnet...`);
  const authTx = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "authorizeAgent",
    args: [profileId, AGENT_ADDRESS as `0x${string}`],
  });

  console.log("authorizeAgent TX submitted:", authTx);
  console.log("Waiting for confirmation on Arc Testnet...");
  const authReceipt = await publicClient.waitForTransactionReceipt({ hash: authTx });
  console.log("Confirmed in Block:", authReceipt.blockNumber.toString());

  console.log("\n=== On-Chain Verification ===");
  const authState = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "isAgentAuthorized",
    args: [profileId, AGENT_ADDRESS as `0x${string}`],
  });
  console.log("isAgentAuthorized:", authState);

  const remainingCredit = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "getRemainingCredit",
    args: [profileId],
  });
  console.log("On-Chain Remaining Credit:", (Number(remainingCredit) / 1e6).toFixed(2), "USDC");

  const outstandingDebt = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "getOutstandingDebt",
    args: [profileId],
  });
  console.log("On-Chain Outstanding Debt:", (Number(outstandingDebt) / 1e6).toFixed(2), "USDC");
}

main().catch(console.error);
