import { NextRequest, NextResponse } from "next/server";
import { BorrowRequest, BorrowResponse } from "@/types";
import { getAllAgents, updateAgentInStore } from "@/lib/agentStore";

export async function POST(req: NextRequest) {
  try {
    const body: BorrowRequest = await req.json();
    const { agentAddress, amount } = body;

    if (!agentAddress || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: agentAddress, amount" },
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

    const all = getAllAgents();
    const agent = all.find(
      (a) => a.address.toLowerCase() === agentAddress.toLowerCase()
    );

    const creditLimit = agent?.creditLimit ?? 500;
    const currentDebt = agent?.outstandingDebt ?? 0;
    const availableCredit = Math.max(0, creditLimit - currentDebt);

    if (borrowAmount > availableCredit) {
      return NextResponse.json(
        {
          success: false,
          error: `Draw exceeds available credit limit. Available: $${availableCredit.toFixed(2)} USDC, Requested: $${borrowAmount.toFixed(2)} USDC`,
        },
        { status: 403 }
      );
    }

    const newDebt = currentDebt + borrowAmount;
    const totalBorrowed = (agent?.totalBorrowed ?? 0) + borrowAmount;
    const currentBalance = (agent?.currentBalance ?? 0) + borrowAmount;

    updateAgentInStore(agentAddress, {
      outstandingDebt: newDebt,
      totalBorrowed,
      currentBalance,
      status: "Active",
    });

    const mockTxHash = `0xarc${Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

    const response: BorrowResponse = {
      success: true,
      txHash: mockTxHash,
      amount: borrowAmount,
      newOutstandingDebt: newDebt,
      agentAddress,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process borrow request" },
      { status: 500 }
    );
  }
}
