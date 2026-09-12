import { NextRequest, NextResponse } from "next/server";
import { BorrowRequest, BorrowResponse } from "@/types";
import {
  getAgentByAddress,
  updateAgentInStore,
  getHumanFacilityStats,
} from "@/lib/agentStore";
import { createLoan } from "@/lib/loanStore";
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_NAME, FLOAT_CREDIT_FACILITY_ADDRESS } from "@/lib/arc";
import { executeOnChainDrawdown } from "@/lib/facilityContract";

export async function POST(req: NextRequest) {
  try {
    const body: BorrowRequest = await req.json();
    const { agentAddress, amount, memo } = body;

    if (!agentAddress) {
      return NextResponse.json(
        { success: false, error: "Missing required field: agentAddress" },
        { status: 400 }
      );
    }

    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { success: false, error: "Missing required field: amount" },
        { status: 400 }
      );
    }

    const borrowAmount = parseFloat(amount.toString());
    if (isNaN(borrowAmount) || borrowAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount. Must be a positive number." },
        { status: 400 }
      );
    }

    // 1. Check Agent in Store
    const agent = getAgentByAddress(agentAddress);
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent ${agentAddress} is not registered with Float credit facility. Please add the agent first.`,
        },
        { status: 404 }
      );
    }

    // 2. Check Agent Status
    if (agent.status === "Suspended" || agent.status === "Delinquent") {
      return NextResponse.json(
        {
          success: false,
          error: `Agent credit facility is currently ${agent.status.toLowerCase()}. Draws are restricted.`,
        },
        { status: 403 }
      );
    }

    // 3. Human Borrower Credit Limits & Outstanding Headroom
    const facility = getHumanFacilityStats(agent.humanOwner);
    const agentAvailable = Math.max(0, agent.creditLimit - agent.outstandingDebt);
    const facilityAvailable = facility.totalAvailableCredit;
    const effectiveAvailable = Math.min(agentAvailable, facilityAvailable);

    if (borrowAmount > effectiveAvailable) {
      return NextResponse.json(
        {
          success: false,
          error: `Draw exceeds credit limit. Available: $${effectiveAvailable.toFixed(
            2
          )} USDC (Agent limit: $${agentAvailable.toFixed(
            2
          )}, Human facility headroom: $${facilityAvailable.toFixed(
            2
          )}). Requested: $${borrowAmount.toFixed(2)} USDC.`,
        },
        { status: 403 }
      );
    }

    // 4. Real On-Chain Arc Testnet Settlement
    const onChainResult = await executeOnChainDrawdown({
      agentAddress: agent.address,
      humanOwner: agent.humanOwner,
      amountUsdc: borrowAmount,
      paymentReference: memo || "Manual Credit Draw on Arc Testnet",
    });
    const arcTxHash = onChainResult.txHash;

    // 5. Create atomic Loan record
    const loan = createLoan({
      agentAddress: agent.address,
      agentName: agent.name,
      humanOwner: agent.humanOwner,
      amount: borrowAmount,
      txHash: arcTxHash,
      memo: memo || "Autonomous Credit Draw on Arc Testnet",
    });

    // 6. Update Agent Financials
    const newDebt = agent.outstandingDebt + borrowAmount;
    const newTotalBorrowed = agent.totalBorrowed + borrowAmount;
    const newBalance = agent.currentBalance + borrowAmount;

    updateAgentInStore(agent.address, {
      outstandingDebt: newDebt,
      totalBorrowed: newTotalBorrowed,
      currentBalance: newBalance,
      status: "Active",
    });

    const updatedFacility = getHumanFacilityStats(agent.humanOwner);

    const response: BorrowResponse = {
      success: true,
      loanId: loan.loanId,
      txHash: arcTxHash,
      amount: borrowAmount,
      newOutstandingDebt: newDebt,
      facilityTotalDebt: updatedFacility.totalOutstandingDebt,
      agentAddress: agent.address,
      humanOwner: agent.humanOwner,
    };

    return NextResponse.json({
      ...response,
      agentName: agent.name,
      agentAvailableCredit: Math.max(0, agent.creditLimit - newDebt),
      facilityAvailableCredit: updatedFacility.totalAvailableCredit,
      network: `${ARC_TESTNET_NAME} (${ARC_TESTNET_CHAIN_ID})`,
      facilityContractAddress: FLOAT_CREDIT_FACILITY_ADDRESS,
      message: `Successfully disbursed $${borrowAmount.toFixed(
        2
      )} USDC on Arc Testnet.`,
    });
  } catch (error: any) {
    console.error("[POST /api/borrow] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute borrow draw" },
      { status: 500 }
    );
  }
}
