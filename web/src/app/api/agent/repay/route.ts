import { NextRequest, NextResponse } from "next/server";
import { RepayRequest, RepayResponse } from "@/types";
import { getAllAgents, updateAgentInStore } from "@/lib/agentStore";

export async function POST(req: NextRequest) {
  try {
    const body: RepayRequest = await req.json();
    const { agentAddress, amount } = body;

    if (!agentAddress || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: agentAddress, amount" },
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

    const all = getAllAgents();
    const agent = all.find(
      (a) => a.address.toLowerCase() === agentAddress.toLowerCase()
    );

    const currentDebt = agent?.outstandingDebt ?? 0;
    const newDebt = Math.max(0, currentDebt - repayAmount);
    const totalRepaid = (agent?.totalRepaid ?? 0) + repayAmount;

    updateAgentInStore(agentAddress, {
      outstandingDebt: newDebt,
      totalRepaid,
      status: newDebt === 0 ? "Healthy" : "Active",
    });

    const mockTxHash = `0xarc${Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

    const response: RepayResponse = {
      success: true,
      txHash: mockTxHash,
      amount: repayAmount,
      remainingDebt: newDebt,
      agentAddress,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process repayment" },
      { status: 500 }
    );
  }
}
