import { NextRequest, NextResponse } from "next/server";
import { BorrowRequest, BorrowResponse } from "@/types";

// In-memory agent state for local scaffolding & mock fallbacks
// In full production, this syncs with FloatCreditManager contract on Arc and The Graph
const MOCK_CREDIT_REGISTRY: Record<string, { creditLimit: number; outstandingDebt: number }> = {
  "0x2222222222222222222222222222222222222222": { creditLimit: 500, outstandingDebt: 0 },
  "0x913a80277353f88f8d68bc3eefbb4806a6b878f2": { creditLimit: 500, outstandingDebt: 32 },
  "0x42f7c02b36a8e809311bc4c80b98024220b2491a": { creditLimit: 350, outstandingDebt: 180 },
};

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

    const normalizedAddress = agentAddress.toLowerCase();
    const agentProfile = MOCK_CREDIT_REGISTRY[normalizedAddress] || {
      creditLimit: 250,
      outstandingDebt: 0,
    };

    const availableCredit = agentProfile.creditLimit - agentProfile.outstandingDebt;
    if (borrowAmount > availableCredit) {
      return NextResponse.json(
        {
          success: false,
          error: `Draw exceeds available credit limit. Available: $${availableCredit.toFixed(2)} USDC, Requested: $${borrowAmount.toFixed(2)} USDC`,
        },
        { status: 403 }
      );
    }

    // Update debt
    agentProfile.outstandingDebt += borrowAmount;
    MOCK_CREDIT_REGISTRY[normalizedAddress] = agentProfile;

    const mockTxHash = `0xarc${Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

    const response: BorrowResponse = {
      success: true,
      txHash: mockTxHash,
      amount: borrowAmount,
      newOutstandingDebt: agentProfile.outstandingDebt,
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
