import { NextRequest, NextResponse } from "next/server";
import { RepayRequest, RepayResponse } from "@/types";
import {
  getAgentByAddress,
  updateAgentInStore,
  getHumanFacilityStats,
  getAgentsByOwner,
} from "@/lib/agentStore";
import { processRepayment, getLoansByAgent } from "@/lib/loanStore";
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_NAME, FLOAT_CREDIT_FACILITY_ADDRESS } from "@/lib/arc";
import { executeOnChainRepayment } from "@/lib/facilityContract";

export async function POST(req: NextRequest) {
  try {
    const body: RepayRequest = await req.json();
    const { agentAddress, amount, targetAgentAddress, targetLoanId, txHash } =
      body;

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

    const repayAmount = parseFloat(amount.toString());
    if (isNaN(repayAmount) || repayAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount. Must be a positive number." },
        { status: 400 }
      );
    }

    // 1. Verify Paying Agent
    const payingAgent = getAgentByAddress(agentAddress);
    if (!payingAgent) {
      return NextResponse.json(
        {
          success: false,
          error: `Paying agent ${agentAddress} is not registered in Float registry.`,
        },
        { status: 404 }
      );
    }

    // 2. Resolve Beneficiary / Target Agent
    // In Float, the Human is the actual borrower.
    // Sibling agents under the same human can repay each other's debt seamlessly.
    let beneficiaryAddress = payingAgent.address;
    if (targetAgentAddress) {
      const targetAgent = getAgentByAddress(targetAgentAddress);
      if (!targetAgent) {
        return NextResponse.json(
          {
            success: false,
            error: `Target agent ${targetAgentAddress} not found.`,
          },
          { status: 404 }
        );
      }
      if (
        targetAgent.humanOwner.toLowerCase() !==
        payingAgent.humanOwner.toLowerCase()
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Cross-agent repayment permitted only between agents owned by the same verified Human Operator (${payingAgent.humanOwner.slice(
              0,
              10
            )}...).`,
          },
          { status: 403 }
        );
      }
      beneficiaryAddress = targetAgent.address;
    }

    // 3. Check if there is any debt to repay
    const humanFacility = getHumanFacilityStats(payingAgent.humanOwner);
    if (humanFacility.totalOutstandingDebt <= 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No outstanding debt exists on this agent or human credit facility to repay.",
        },
        { status: 400 }
      );
    }

    // 4. Real On-Chain Arc Testnet Settlement
    let arcTxHash = txHash;
    if (!arcTxHash) {
      const onChainRepay = await executeOnChainRepayment({
        humanOwner: payingAgent.humanOwner,
        payerAddress: payingAgent.address,
        agentAddress: beneficiaryAddress,
        amountUsdc: repayAmount,
      });
      arcTxHash = onChainRepay.txHash;
    }

    // 5. Process Repayment against Loan Ledger
    const result = processRepayment({
      payingAgentAddress: payingAgent.address,
      amount: repayAmount,
      targetAgentAddress: beneficiaryAddress,
      targetLoanId,
      humanOwner: payingAgent.humanOwner,
      txHash: arcTxHash,
    });

    // 6. Synchronize all affected Agents under this Human Facility
    const humanAgents = getAgentsByOwner(payingAgent.humanOwner);
    for (const a of humanAgents) {
      const activeLoans = getLoansByAgent(a.address).filter(
        (l) => l.status === "ACTIVE"
      );
      const remainingDebt = activeLoans.reduce(
        (sum, l) => sum + l.outstandingAmount,
        0
      );
      const isBeneficiary =
        a.address.toLowerCase() === beneficiaryAddress.toLowerCase();
      const isPayer =
        a.address.toLowerCase() === payingAgent.address.toLowerCase();

      updateAgentInStore(a.address, {
        outstandingDebt: remainingDebt,
        currentBalance: isPayer
          ? Math.max(0, a.currentBalance - result.amountRepaid)
          : a.currentBalance,
        totalRepaid: isPayer
          ? a.totalRepaid + result.amountRepaid
          : a.totalRepaid,
        status: remainingDebt === 0 ? "Healthy" : "Active",
      });
    }

    const updatedFacility = getHumanFacilityStats(payingAgent.humanOwner);
    const updatedBeneficiary = getAgentByAddress(beneficiaryAddress);

    const response: RepayResponse = {
      success: true,
      txHash: arcTxHash,
      amount: result.amountRepaid,
      remainingDebt: updatedBeneficiary?.outstandingDebt || 0,
      refundExcess: result.remainingExcessAmount,
      agentAddress: payingAgent.address,
      beneficiaryAgentAddress: beneficiaryAddress,
      facilityTotalDebt: updatedFacility.totalOutstandingDebt,
      settledLoans: result.settledLoans,
    };

    const message =
      result.remainingExcessAmount > 0
        ? `Repaid $${result.amountRepaid.toFixed(
            2
          )} USDC on Arc Testnet (debt settled). Unapplied excess of $${result.remainingExcessAmount.toFixed(
            2
          )} USDC was NOT deducted and remains in agent wallet.`
        : `Repaid $${result.amountRepaid.toFixed(
            2
          )} USDC on Arc Testnet. Facility outstanding debt: $${updatedFacility.totalOutstandingDebt.toFixed(
            2
          )} USDC.`;

    return NextResponse.json({
      ...response,
      payingAgentName: payingAgent.name,
      beneficiaryAgentName: updatedBeneficiary?.name || payingAgent.name,
      network: `${ARC_TESTNET_NAME} (${ARC_TESTNET_CHAIN_ID})`,
      facilityContractAddress: FLOAT_CREDIT_FACILITY_ADDRESS,
      message,
    });
  } catch (error: any) {
    console.error("[POST /api/repay] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process repayment" },
      { status: 500 }
    );
  }
}
