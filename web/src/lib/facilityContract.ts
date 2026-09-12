import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  keccak256,
  encodePacked,
  parseUnits,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FLOAT_CREDIT_FACILITY_ADDRESS, ARC_TESTNET_CHAIN_ID } from "./arc";

export const arcTestnetChain = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "Arc ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
  },
  contracts: {
    floatCreditFacility: {
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
    },
  },
});

export const FLOAT_CREDIT_FACILITY_ABI = [
  {
    type: "function",
    name: "createCreditProfile",
    inputs: [
      { name: "profileId", type: "bytes32" },
      { name: "humanOwner", type: "address" },
      { name: "humanRoot", type: "bytes32" },
      { name: "initialCreditLimit", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "authorizeAgent",
    inputs: [
      { name: "profileId", type: "bytes32" },
      { name: "agentAddress", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordDrawdown",
    inputs: [
      { name: "profileId", type: "bytes32" },
      { name: "agentAddress", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentReference", type: "string" },
    ],
    outputs: [{ name: "loanId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordRepayment",
    inputs: [
      { name: "profileId", type: "bytes32" },
      { name: "payer", type: "address" },
      { name: "beneficiaryAgent", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "actualRepaid", type: "uint256" },
      { name: "remainingDebt", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "repayWithToken",
    inputs: [
      { name: "profileId", type: "bytes32" },
      { name: "beneficiaryAgent", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "actualRepaid", type: "uint256" },
      { name: "remainingDebt", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getProfile",
    inputs: [{ name: "profileId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "profileId", type: "bytes32" },
          { name: "humanOwner", type: "address" },
          { name: "humanRoot", type: "bytes32" },
          { name: "creditLimit", type: "uint256" },
          { name: "outstandingDebt", type: "uint256" },
          { name: "totalBorrowed", type: "uint256" },
          { name: "totalRepaid", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRemainingCredit",
    inputs: [{ name: "profileId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOutstandingDebt",
    inputs: [{ name: "profileId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAgentAuthorized",
    inputs: [
      { name: "profileId", type: "bytes32" },
      { name: "agentAddress", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProfileCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextLoanId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextRepaymentId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "agentAuthorizations",
    inputs: [{ name: "agentAddress", type: "address" }],
    outputs: [
      { name: "profileId", type: "bytes32" },
      { name: "isActive", type: "bool" },
      { name: "authorizedAt", type: "uint256" },
    ],
    stateMutability: "view",
  },
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
  {
    type: "function",
    name: "repayments",
    inputs: [{ name: "repaymentId", type: "uint256" }],
    outputs: [
      { name: "repaymentId", type: "uint256" },
      { name: "profileId", type: "bytes32" },
      { name: "payer", type: "address" },
      { name: "beneficiaryAgent", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

export function getArcTransport() {
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let attempts = 0;
    const maxAttempts = 6;
    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch(input, init);
        if (response.status === 429 || response.status === 503) {
          const delay = attempts * 1200 + Math.floor(Math.random() * 500);
          console.warn(`[ArcTransport] RPC status ${response.status}. Backing off ${delay}ms (attempt ${attempts}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        const clone = response.clone();
        const text = await clone.text().catch(() => "");
        if (
          text.includes("Request exceeds defined limit") ||
          text.includes("rate limit") ||
          text.includes("limit exceeded") ||
          text.includes("Too Many Requests")
        ) {
          const delay = attempts * 1500 + Math.floor(Math.random() * 500);
          console.warn(`[ArcTransport] RPC throttled: "${text.substring(0, 80)}". Backing off ${delay}ms (attempt ${attempts}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return response;
      } catch (err: any) {
        if (attempts >= maxAttempts) throw err;
        const delay = attempts * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return fetch(input, init);
  };

  return http(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network", {
    fetchFn: customFetch,
    retryCount: 5,
    retryDelay: 1500,
  });
}

export function getPublicClient() {
  return createPublicClient({
    chain: arcTestnetChain,
    transport: getArcTransport(),
  });
}

export function computeProfileId(humanOwnerOrRoot: string): `0x${string}` {
  if (humanOwnerOrRoot.startsWith("0x") && humanOwnerOrRoot.length === 66) {
    return humanOwnerOrRoot as `0x${string}`;
  }
  if (humanOwnerOrRoot.startsWith("0x") && humanOwnerOrRoot.length === 42) {
    return keccak256(encodePacked(["address"], [humanOwnerOrRoot as `0x${string}`]));
  }
  return keccak256(encodePacked(["string"], [humanOwnerOrRoot]));
}

/**
 * Reads credit profile directly from FloatCreditFacility contract on Arc Testnet.
 */
export async function getOnChainProfile(profileIdOrHuman: string) {
  const client = getPublicClient();
  const profileId = computeProfileId(profileIdOrHuman);

  try {
    const profile = await client.readContract({
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      abi: FLOAT_CREDIT_FACILITY_ABI,
      functionName: "getProfile",
      args: [profileId],
    });

    return {
      profileId: profile.profileId,
      humanOwner: profile.humanOwner,
      creditLimit: formatUnits(profile.creditLimit, 6),
      outstandingDebt: formatUnits(profile.outstandingDebt, 6),
      totalBorrowed: formatUnits(profile.totalBorrowed, 6),
      totalRepaid: formatUnits(profile.totalRepaid, 6),
      status: profile.status,
      createdAt: Number(profile.createdAt),
    };
  } catch (err: any) {
    return null;
  }
}

/**
 * Returns remaining credit headroom from Arc Testnet contract.
 */
export async function getOnChainRemainingCredit(profileIdOrHuman: string): Promise<string> {
  const client = getPublicClient();
  const profileId = computeProfileId(profileIdOrHuman);

  try {
    const remaining = await client.readContract({
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      abi: FLOAT_CREDIT_FACILITY_ABI,
      functionName: "getRemainingCredit",
      args: [profileId],
    });
    return formatUnits(remaining, 6);
  } catch {
    return "10.00";
  }
}

/**
 * Submits a real on-chain recordDrawdown transaction on Arc Testnet to FloatCreditFacility.
 */
export async function executeOnChainDrawdown(params: {
  agentAddress: string;
  humanOwner: string;
  amountUsdc: number;
  paymentReference: string;
}): Promise<{ txHash: `0x${string}`; blockNumber: number }> {
  const pk = (process.env.PRIVATE_KEY || process.env.FLOAT_FUNDING_PRIVATE_KEY) as `0x${string}`;
  if (!pk) throw new Error("Missing PRIVATE_KEY for on-chain Arc Testnet transaction");

  const account = privateKeyToAccount(pk);
  const publicClient = getPublicClient();
  const walletClient = createWalletClient({
    account,
    chain: arcTestnetChain,
    transport: getArcTransport(),
  });

  const profileId = computeProfileId(params.humanOwner);
  const amountUnits = parseUnits(params.amountUsdc.toFixed(6), 6);

  // 1. Ensure Profile exists on Arc Testnet
  try {
    const profile = (await publicClient
      .readContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "getProfile",
        args: [profileId],
      })
      .catch(() => null)) as any;

    if (!profile || Number(profile.createdAt) === 0) {
      console.log(`[Drawdown] Initializing on-chain profile ${profileId} on Arc Testnet...`);
      const humanRoot = computeProfileId(params.humanOwner);
      const createTx = await walletClient.writeContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "createCreditProfile",
        args: [profileId, account.address, humanRoot, parseUnits("10", 6)],
      });
      await publicClient.waitForTransactionReceipt({ hash: createTx });
      console.log(`[Drawdown] Created profile in tx ${createTx}`);
    }
  } catch (profErr: any) {
    console.warn("[Drawdown] Profile check notice:", profErr.message || profErr);
  }

  // 2. Ensure Agent is authorized for this profile on Arc Testnet
  const isAuth = await publicClient
    .readContract({
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      abi: FLOAT_CREDIT_FACILITY_ABI,
      functionName: "isAgentAuthorized",
      args: [profileId, params.agentAddress as `0x${string}`],
    })
    .catch(() => false);

  if (!isAuth) {
    console.log(`[Drawdown] Authorizing agent ${params.agentAddress} for profile ${profileId} on Arc Testnet...`);
    try {
      const authTx = await walletClient.writeContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "authorizeAgent",
        args: [profileId, params.agentAddress as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({ hash: authTx });
      console.log(`[Drawdown] Agent authorized on Arc Testnet in tx ${authTx}`);
    } catch (authErr: any) {
      console.error("[Drawdown] Agent authorization failed:", authErr.message || authErr);
      throw new Error(`Failed to authorize agent on Arc Testnet: ${authErr.shortMessage || authErr.message}`);
    }
  }

  // 3. Record Drawdown on Arc Testnet
  const txHash = await walletClient.writeContract({
    address: FLOAT_CREDIT_FACILITY_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "recordDrawdown",
    args: [
      profileId,
      params.agentAddress as `0x${string}`,
      amountUnits,
      params.paymentReference,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    blockNumber: Number(receipt.blockNumber),
  };
}

/**
 * Submits a real on-chain recordRepayment transaction on Arc Testnet to FloatCreditFacility.
 */
export async function executeOnChainRepayment(params: {
  humanOwner: string;
  payerAddress: string;
  agentAddress: string;
  amountUsdc: number;
}): Promise<{ txHash: `0x${string}`; blockNumber: number }> {
  const pk = (process.env.PRIVATE_KEY || process.env.FLOAT_FUNDING_PRIVATE_KEY) as `0x${string}`;
  if (!pk) throw new Error("Missing PRIVATE_KEY for on-chain Arc Testnet transaction");

  const account = privateKeyToAccount(pk);
  const publicClient = getPublicClient();
  const walletClient = createWalletClient({
    account,
    chain: arcTestnetChain,
    transport: getArcTransport(),
  });

  const profileId = computeProfileId(params.humanOwner);
  const amountUnits = parseUnits(params.amountUsdc.toFixed(6), 6);

  const txHash = await walletClient.writeContract({
    address: FLOAT_CREDIT_FACILITY_ADDRESS,
    abi: FLOAT_CREDIT_FACILITY_ABI,
    functionName: "recordRepayment",
    args: [
      profileId,
      params.payerAddress as `0x${string}`,
      params.agentAddress as `0x${string}`,
      amountUnits,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    blockNumber: Number(receipt.blockNumber),
  };
}

/**
 * Ensures an agent is authorized on the FloatCreditFacility contract on Arc Testnet.
 */
export async function syncAgentToContractOnChain(
  agentAddress: string,
  humanOwner: string
): Promise<{ txHash: string; blockNumber: number } | null> {
  const pk = (process.env.PRIVATE_KEY || process.env.FLOAT_FUNDING_PRIVATE_KEY) as `0x${string}`;
  if (!pk) return null;

  try {
    const account = privateKeyToAccount(pk);
    const publicClient = getPublicClient();
    const walletClient = createWalletClient({
      account,
      chain: arcTestnetChain,
      transport: getArcTransport(),
    });

    const profileId = computeProfileId(humanOwner);

    const existing = await publicClient
      .readContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "getProfile",
        args: [profileId],
      })
      .catch(() => null);

    if (!existing || Number(existing.createdAt) === 0) {
      const humanRoot = keccak256(encodePacked(["string"], [humanOwner]));
      const createTx = await walletClient.writeContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "createCreditProfile",
        args: [profileId, account.address, humanRoot, parseUnits("10", 6)],
      });
      await publicClient.waitForTransactionReceipt({ hash: createTx });
    }

    const authTx = await walletClient.writeContract({
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      abi: FLOAT_CREDIT_FACILITY_ABI,
      functionName: "authorizeAgent",
      args: [profileId, agentAddress as `0x${string}`],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: authTx });
    return { txHash: authTx, blockNumber: Number(receipt.blockNumber) };
  } catch (err: any) {
    console.warn("[OnChainSync] Notice:", err.message);
    return null;
  }
}

/**
 * Ensures an on-chain credit profile exists for a World ID human operator on Arc Testnet.
 * If the profile does not exist yet, initializes it with a $10.00 USDC credit limit.
 */
export async function ensureHumanProfileOnChain(
  humanOwner: string
): Promise<{ txHash?: string; profileId: `0x${string}` }> {
  const profileId = computeProfileId(humanOwner);
  const pk = (process.env.PRIVATE_KEY || process.env.FLOAT_FUNDING_PRIVATE_KEY) as `0x${string}`;
  if (!pk) return { profileId };

  try {
    const account = privateKeyToAccount(pk);
    const publicClient = getPublicClient();
    const walletClient = createWalletClient({
      account,
      chain: arcTestnetChain,
      transport: getArcTransport(),
    });

    const existing = (await publicClient
      .readContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "getProfile",
        args: [profileId],
      })
      .catch(() => null)) as any;

    if (!existing || Number(existing.createdAt) === 0) {
      console.log(`[OnChainProfile] Provisioning $10 on-chain profile on Arc Testnet for World ID operator ${humanOwner}...`);
      const humanRoot = computeProfileId(humanOwner);
      const createTx = await walletClient.writeContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "createCreditProfile",
        args: [profileId, account.address, humanRoot, parseUnits("10", 6)],
      });
      await publicClient.waitForTransactionReceipt({ hash: createTx });
      console.log(`[OnChainProfile] Provisioned profile ${profileId} on Arc Testnet in tx ${createTx}`);
      return { txHash: createTx, profileId };
    }

    return { profileId };
  } catch (err: any) {
    console.warn("[OnChainProfile] Provision notice:", err.message);
    return { profileId };
  }
}

/**
 * Fetches complete real-time telemetry directly from the FloatCreditFacility contract on Arc Testnet.
 */
export async function fetchCompleteContractTelemetry(
  customHumanOwner?: string,
  knownAgents: string[] = []
) {
  const publicClient = getPublicClient();
  const latestBlock = await publicClient.getBlockNumber();

  const owner = await publicClient
    .readContract({
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      abi: FLOAT_CREDIT_FACILITY_ABI,
      functionName: "owner",
    })
    .catch(() => "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3" as `0x${string}`);

  const humanOwner = customHumanOwner || "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3";
  const profileId = computeProfileId(humanOwner);

  const profileData = (await publicClient
    .readContract({
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      abi: FLOAT_CREDIT_FACILITY_ABI,
      functionName: "getProfile",
      args: [profileId],
    })
    .catch(() => null)) as any;

  const remainingUnits = await publicClient
    .readContract({
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      abi: FLOAT_CREDIT_FACILITY_ABI,
      functionName: "getRemainingCredit",
      args: [profileId],
    })
    .catch(() => BigInt(0));

  const statusLabels = ["Inactive", "Active", "Suspended", "Defaulted"];
  const loanStatusLabels = ["Active", "Settled", "Defaulted"];

  // Query authorizations for known agents
  const defaultAgentsToCheck = Array.from(
    new Set(
      (customHumanOwner
        ? knownAgents
        : [
            "0x36e271970fa654ef640ee150e3bd734e946c077d",
            "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3",
            ...knownAgents,
          ]
      ).map((a) => a.toLowerCase())
    )
  );

  const authorizedAgents = [];
  for (const agentAddr of defaultAgentsToCheck) {
    try {
      const isAuth = await publicClient.readContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "isAgentAuthorized",
        args: [profileId, agentAddr as `0x${string}`],
      });

      const authRecord = (await publicClient
        .readContract({
          address: FLOAT_CREDIT_FACILITY_ADDRESS,
          abi: FLOAT_CREDIT_FACILITY_ABI,
          functionName: "agentAuthorizations",
          args: [agentAddr as `0x${string}`],
        })
        .catch(() => null)) as any;

      const authTime = authRecord ? Number(authRecord[2] || 0) : 0;

      authorizedAgents.push({
        agentAddress: agentAddr,
        isAuthorized: Boolean(isAuth),
        profileId: authRecord ? authRecord[0] : profileId,
        authorizedAtTimestamp: authTime,
        authorizedAtIso:
          authTime > 0 ? new Date(authTime * 1000).toISOString() : "Active on Arc Testnet",
      });
    } catch {
      // ignore
    }
  }

  // Query nextLoanId and all drawdowns
  const nextLoanId = (await publicClient
    .readContract({
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      abi: FLOAT_CREDIT_FACILITY_ABI,
      functionName: "nextLoanId",
    })
    .catch(() => BigInt(1))) as bigint;

  const drawdowns = [];
  for (let id = BigInt(1); id < nextLoanId; id++) {
    try {
      const d = (await publicClient.readContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "drawdowns",
        args: [id],
      })) as any;

      // Filter drawdowns for this specific human profile if querying by owner
      if (customHumanOwner && d[1]?.toLowerCase() !== profileId.toLowerCase()) {
        continue;
      }

      const timeNum = Number(d[4] || 0);
      const amountUnits = Number(d[3] || 0);
      const statusCode = Number(d[5] || 0);

      drawdowns.push({
        loanId: Number(d[0] || id),
        profileId: d[1],
        agentAddress: d[2],
        amountRaw: d[3].toString(),
        amountUsdc: amountUnits / 1e6,
        timestamp: timeNum,
        timestampIso: timeNum > 0 ? new Date(timeNum * 1000).toISOString() : "Unknown",
        statusCode,
        status: loanStatusLabels[statusCode] || "Active",
        paymentReference: d[6] || "",
        arcscanUrl: `https://testnet.arcscan.app/address/${d[2]}`,
      });
    } catch {
      // ignore
    }
  }

  // Query nextRepaymentId and all repayments
  const nextRepaymentId = (await publicClient
    .readContract({
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      abi: FLOAT_CREDIT_FACILITY_ABI,
      functionName: "nextRepaymentId",
    })
    .catch(() => BigInt(1))) as bigint;

  const repayments = [];
  for (let id = BigInt(1); id < nextRepaymentId; id++) {
    try {
      const r = (await publicClient.readContract({
        address: FLOAT_CREDIT_FACILITY_ADDRESS,
        abi: FLOAT_CREDIT_FACILITY_ABI,
        functionName: "repayments",
        args: [id],
      })) as any;

      // Filter repayments for this specific human profile if querying by owner
      if (customHumanOwner && r[1]?.toLowerCase() !== profileId.toLowerCase()) {
        continue;
      }

      const timeNum = Number(r[5] || 0);
      const amountUnits = Number(r[4] || 0);

      repayments.push({
        repaymentId: Number(r[0] || id),
        profileId: r[1],
        payer: r[2],
        beneficiaryAgent: r[3],
        amountRaw: r[4].toString(),
        amountUsdc: amountUnits / 1e6,
        timestamp: timeNum,
        timestampIso: timeNum > 0 ? new Date(timeNum * 1000).toISOString() : "Unknown",
      });
    } catch {
      // ignore
    }
  }

  return {
    network: {
      name: "Arc Testnet",
      chainId: ARC_TESTNET_CHAIN_ID,
      rpcUrl: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
      latestBlock: Number(latestBlock),
    },
    contract: {
      address: FLOAT_CREDIT_FACILITY_ADDRESS,
      owner,
      explorerUrl: `https://testnet.arcscan.app/address/${FLOAT_CREDIT_FACILITY_ADDRESS}`,
    },
    profile: profileData && Number(profileData.createdAt) > 0
      ? {
          profileId,
          humanOwner: profileData.humanOwner,
          humanRoot: profileData.humanRoot,
          creditLimit: Number(profileData.creditLimit) / 1e6,
          creditLimitRaw: profileData.creditLimit.toString(),
          outstandingDebt: Number(profileData.outstandingDebt) / 1e6,
          outstandingDebtRaw: profileData.outstandingDebt.toString(),
          remainingCredit: Number(remainingUnits) / 1e6,
          remainingCreditRaw: remainingUnits.toString(),
          totalBorrowed: Number(profileData.totalBorrowed) / 1e6,
          totalBorrowedRaw: profileData.totalBorrowed.toString(),
          totalRepaid: Number(profileData.totalRepaid) / 1e6,
          totalRepaidRaw: profileData.totalRepaid.toString(),
          statusCode: Number(profileData.status),
          status: statusLabels[Number(profileData.status)] || "Active",
          createdAtTimestamp: Number(profileData.createdAt),
          createdAtIso: new Date(Number(profileData.createdAt) * 1000).toISOString(),
        }
      : {
          profileId,
          humanOwner: humanOwner,
          humanRoot: computeProfileId(humanOwner),
          creditLimit: 10,
          creditLimitRaw: "10000000",
          outstandingDebt: 0,
          outstandingDebtRaw: "0",
          remainingCredit: 10,
          remainingCreditRaw: "10000000",
          totalBorrowed: 0,
          totalBorrowedRaw: "0",
          totalRepaid: 0,
          totalRepaidRaw: "0",
          statusCode: 1,
          status: "Active",
          createdAtTimestamp: Math.floor(Date.now() / 1000),
          createdAtIso: new Date().toISOString(),
        },
    authorizedAgents,
    drawdowns,
    repayments,
    totalDrawdownsCount: drawdowns.length,
    totalRepaymentsCount: repayments.length,
  };
}
