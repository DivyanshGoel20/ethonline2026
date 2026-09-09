import { NextRequest, NextResponse } from "next/server";
import { getAgentByAddress } from "@/lib/agentStore";
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_NAME } from "@/lib/arc";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentAddress =
      searchParams.get("agentAddress") ||
      searchParams.get("address") ||
      req.headers.get("x-agent-address");

    if (!agentAddress) {
      return NextResponse.json(
        {
          error:
            "Missing agent address. Provide ?agentAddress=0x... or x-agent-address header.",
        },
        { status: 400 }
      );
    }

    const agent = getAgentByAddress(agentAddress);
    if (!agent) {
      return NextResponse.json(
        { error: `Agent ${agentAddress} not found in Float registry.` },
        { status: 404 }
      );
    }

    const rpcUrl = process.env.ARC_RPC_URL || "https://rpc.arc.io/testnet";
    const availableCredit = Math.max(0, agent.creditLimit - agent.outstandingDebt);

    return NextResponse.json({
      agentAddress: agent.address,
      name: agent.name,
      liquidBalanceUSDC: agent.currentBalance,
      outstandingDebtUSDC: agent.outstandingDebt,
      availableCreditUSDC: availableCredit,
      creditLimitUSDC: agent.creditLimit,
      network: `${ARC_TESTNET_NAME} (${ARC_TESTNET_CHAIN_ID})`,
      rpcUrl,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("[GET /api/agent/balance] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch agent balance" },
      { status: 500 }
    );
  }
}
