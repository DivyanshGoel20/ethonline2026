import { NextRequest, NextResponse } from "next/server";
import { getAgentByAddress } from "@/lib/agentStore";
import { getLoansByAgent, getLoansByHuman, getAllLoans } from "@/lib/loanStore";
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_NAME } from "@/lib/arc";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentAddress =
      searchParams.get("agentAddress") ||
      searchParams.get("address") ||
      req.headers.get("x-agent-address");

    const includeShared = searchParams.get("includeShared") !== "false";
    const statusFilter = searchParams.get("status")?.toUpperCase(); // "ACTIVE" | "SETTLED" | "ALL"

    if (!agentAddress) {
      // If no agent address provided, allow querying all loans if an owner param is provided
      const owner = searchParams.get("owner");
      if (owner) {
        const ownerLoans = getLoansByHuman(owner);
        return NextResponse.json({
          humanOwner: owner,
          totalLoansCount: ownerLoans.length,
          loans: ownerLoans,
        });
      }

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

    // Retrieve loans: either all loans in the human's facility, or strictly for this agent
    let loans = includeShared
      ? getLoansByHuman(agent.humanOwner)
      : getLoansByAgent(agent.address);

    // Filter by status if specified
    if (statusFilter && statusFilter !== "ALL") {
      loans = loans.filter((l) => l.status === statusFilter);
    }

    const activeLoans = loans.filter((l) => l.status === "ACTIVE");
    const totalOutstanding = activeLoans.reduce(
      (sum, l) => sum + l.outstandingAmount,
      0
    );

    return NextResponse.json({
      agentAddress: agent.address,
      agentName: agent.name,
      humanOwner: agent.humanOwner,
      isSharedFacilityView: includeShared,
      totalLoansCount: loans.length,
      activeLoansCount: activeLoans.length,
      totalOutstandingUSDC: totalOutstanding,
      loans,
      network: `${ARC_TESTNET_NAME} (${ARC_TESTNET_CHAIN_ID})`,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("[GET /api/agent/loans] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch loans" },
      { status: 500 }
    );
  }
}
