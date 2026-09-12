import { createWalletClient, createPublicClient, http, parseUnits, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnetChain, FLOAT_CREDIT_FACILITY_ABI } from "../web/src/lib/facilityContract";

const CONTRACT_ADDRESS = "0xAa2d23bAC7b6f9b4ca2737252F924b3F485E0686";
const HUMAN_OWNER = "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3";
const NEW_CREDIT_LIMIT = parseUnits("10", 6); // $10.00 USDC

async function main() {
  const pk = process.env.PRIVATE_KEY as `0x${string}`;
  if (!pk) throw new Error("PRIVATE_KEY missing");

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
  console.log("Profile ID:", profileId);

  console.log("Setting on-chain credit limit to $10.00 USDC...");
  const txHash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: [
      {
        type: "function",
        name: "setCreditLimit",
        inputs: [
          { name: "profileId", type: "bytes32" },
          { name: "newLimit", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ],
    functionName: "setCreditLimit",
    args: [profileId, NEW_CREDIT_LIMIT],
  });

  console.log("Transaction submitted to Arc Testnet:", txHash);
  console.log("Waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("Confirmed in Block:", receipt.blockNumber.toString());

  // Also authorize 0x5233 as agent if not authorized
  console.log("Authorizing 0x5233 as agent on-chain...");
  const authTx = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "authorizeAgent",
    args: [profileId, HUMAN_OWNER as `0x${string}`],
  });
  console.log("authorizeAgent tx:", authTx);
  await publicClient.waitForTransactionReceipt({ hash: authTx });

  const remaining = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "getRemainingCredit",
    args: [profileId],
  });
  console.log("\nVerified On-Chain Remaining Credit:", (Number(remaining) / 1e6).toFixed(2), "USDC");
}

main().catch(console.error);
