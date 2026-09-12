import { NextRequest, NextResponse } from "next/server";
import { fetchCompleteContractTelemetry } from "@/lib/facilityContract";
import { getAllAgents } from "@/lib/agentStore";
import { getAllLoans } from "@/lib/loanStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const humanOwner = searchParams.get("human") || undefined;

    // Retrieve known agents and recorded loan hashes from store to enrich telemetry
    const agents = getAllAgents();
    const knownAgentAddresses = agents.map((a) => a.address);
    const recordedLoans = getAllLoans();

    const telemetry = await fetchCompleteContractTelemetry(humanOwner, knownAgentAddresses);

    // Correlate on-chain drawdowns with recorded txHashes if available
    const enrichedDrawdowns = telemetry.drawdowns.map((d: any) => {
      const matchedLoan = recordedLoans.find(
        (l) =>
          l.loanId === String(d.loanId) ||
          (l.agentAddress.toLowerCase() === d.agentAddress.toLowerCase() &&
            Math.abs(l.amount - d.amountUsdc) < 0.0001)
      );

      const txHash = matchedLoan?.borrowTxHash || undefined;
      return {
        ...d,
        txHash,
        txLink: txHash && txHash.startsWith("0x") ? `https://testnet.arcscan.app/tx/${txHash}` : undefined,
      };
    });

    return NextResponse.json({
      success: true,
      telemetry: {
        ...telemetry,
        drawdowns: enrichedDrawdowns,
      },
      cachedAgentsCount: agents.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("[GET /api/contract-telemetry] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch on-chain smart contract telemetry",
      },
      { status: 500 }
    );
  }
}
