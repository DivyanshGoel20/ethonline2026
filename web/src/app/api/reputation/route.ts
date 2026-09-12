import { NextRequest, NextResponse } from "next/server";
import { getHumanReputationRecord } from "@/lib/reputationStore";
import { getAllLoans } from "@/lib/loanStore";
import { computeHumanReputation } from "@/lib/reputationEngine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const humanOwner =
      searchParams.get("humanOwner") ||
      process.env.HUMAN_OWNER ||
      "";

    if (!humanOwner) {
      return NextResponse.json(
        { success: false, error: "Missing humanOwner query parameter" },
        { status: 400 }
      );
    }

    const record = getHumanReputationRecord(humanOwner);
    const loans = getAllLoans().filter(
      (l) => l.humanOwner.toLowerCase() === humanOwner.toLowerCase()
    );

    const summary = computeHumanReputation(
      humanOwner,
      loans,
      record.repaymentsCount,
      record.totalInterestPaid
    );

    return NextResponse.json({
      success: true,
      summary,
      fifoModelExplanation:
        "Tranche-based FIFO: Repayments clear your oldest active loans first, immediately pushing forward your facility maturity deadline.",
    });
  } catch (error: any) {
    console.error("[GET /api/reputation] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch reputation summary" },
      { status: 500 }
    );
  }
}
