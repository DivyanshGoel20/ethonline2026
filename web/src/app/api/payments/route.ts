import { NextRequest, NextResponse } from "next/server";
import {
  getAllPayments,
  getPaymentsByAgent,
  getPaymentsByHuman,
} from "@/lib/paymentStore";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentAddress = searchParams.get("agentAddress");
    const humanOwner = searchParams.get("humanOwner") || searchParams.get("humanProfileId");

    let payments;
    if (agentAddress) {
      payments = getPaymentsByAgent(agentAddress);
    } else if (humanOwner) {
      payments = getPaymentsByHuman(humanOwner);
    } else {
      payments = getAllPayments();
    }

    return NextResponse.json({
      success: true,
      totalCount: payments.length,
      payments,
    });
  } catch (error: any) {
    console.error("[GET /api/payments] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve payments" },
      { status: 500 }
    );
  }
}
