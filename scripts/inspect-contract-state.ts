import { createPublicClient, http, keccak256, encodePacked } from "viem";
import { arcTestnetChain, FLOAT_CREDIT_FACILITY_ABI } from "../web/src/lib/facilityContract";

const CONTRACT_ADDRESS = "0xAa2d23bAC7b6f9b4ca2737252F924b3F485E0686";
const HUMAN_OWNER = "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3";
const AGENT_UNFUNDED = "0x36e271970fa654ef640ee150e3bd734e946c077d";
const AGENT_FUNDED = "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3";

async function main() {
  const publicClient = createPublicClient({
    chain: arcTestnetChain,
    transport: http("https://rpc.testnet.arc.network"),
  });

  const profileId = keccak256(encodePacked(["address"], [HUMAN_OWNER]));

  console.log("=== FloatCreditFacility On-Chain State on Arc Testnet ===");
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("Human Owner:", HUMAN_OWNER);
  console.log("Profile ID:", profileId);

  const profile = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "getProfile",
    args: [profileId],
  }) as any;

  console.log("\nProfile Details:");
  console.log(" - Human Owner:", profile.humanOwner);
  console.log(" - Credit Limit:", (Number(profile.creditLimit) / 1e6).toFixed(2), "USDC (raw:", profile.creditLimit.toString(), ")");
  console.log(" - Outstanding Debt:", (Number(profile.outstandingDebt) / 1e6).toFixed(2), "USDC (raw:", profile.outstandingDebt.toString(), ")");
  console.log(" - Total Borrowed:", (Number(profile.totalBorrowed) / 1e6).toFixed(2), "USDC (raw:", profile.totalBorrowed.toString(), ")");
  console.log(" - Total Repaid:", (Number(profile.totalRepaid) / 1e6).toFixed(2), "USDC (raw:", profile.totalRepaid.toString(), ")");
  console.log(" - Active:", profile.isActive);
  console.log(" - Created At:", new Date(Number(profile.createdAt) * 1000).toISOString());

  const remaining = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "getRemainingCredit",
    args: [profileId],
  });
  console.log(" - Remaining Credit:", (Number(remaining) / 1e6).toFixed(2), "USDC");

  const isAuthUnfunded = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "isAgentAuthorized",
    args: [profileId, AGENT_UNFUNDED as `0x${string}`],
  });
  console.log(` - Agent ${AGENT_UNFUNDED} authorized:`, isAuthUnfunded);

  const isAuthFunded = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "isAgentAuthorized",
    args: [profileId, AGENT_FUNDED as `0x${string}`],
  });
  console.log(` - Agent ${AGENT_FUNDED} authorized:`, isAuthFunded);

  // Read drawdown count / loans
  const nextLoanId = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: [
      {
        type: "function",
        name: "nextLoanId",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
    ],
    functionName: "nextLoanId",
    args: [],
  }) as bigint;
  console.log("\nNext Loan ID (total drawdowns across contract):", nextLoanId.toString());

  // Print recent loans
  for (let id = 1n; id < nextLoanId; id++) {
    const loan = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: [
        {
          type: "function",
          name: "drawdowns",
          inputs: [{ name: "loanId", type: "uint256" }],
          outputs: [
            { name: "loanId", type: "uint256" },
            { name: "profileId", type: "bytes32" },
            { name: "agentAddress", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "timestamp", type: "uint256" },
            { name: "status", type: "uint8" },
            { name: "paymentReference", type: "string" },
          ],
          stateMutability: "view",
        },
      ],
      functionName: "drawdowns",
      args: [id],
    }) as any;
    console.log(` Loan #${id}: LoanId=${loan[0]}, Agent=${loan[2]}, Amount=${(Number(loan[3])/1e6).toFixed(4)} USDC, Status=${loan[5]}, Ref="${loan[6]}"`);
  }
}

main().catch(console.error);
