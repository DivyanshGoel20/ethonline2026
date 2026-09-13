import { NextRequest, NextResponse } from "next/server";
import { getHuman, unauthenticated } from "@/lib/session";
import { HEDERA_PAYER_URL } from "@/lib/rails";
import { getHumanFacilityStats } from "@/lib/agentStore";
import { openRailDebt } from "@/lib/railDebt";
import { invalidateTelemetryCache } from "@/lib/telemetryCache";

/**
 * Buy something on the Hedera rail.
 *
 * Gated on a verified human rather than on agent ownership: this rail pays from
 * a single configured Hedera identity rather than from one of the Arc agents,
 * so there is no per-agent key to check. The World session is still the bar -
 * spending money always is.
 */
export async function POST(req: NextRequest) {
  const human = getHuman(req);
  if (!human) return unauthenticated();

  const { url } = await req.json().catch(() => ({ url: "" }));
  if (!url) {
    return NextResponse.json({ success: false, error: "Missing resource url" }, { status: 400 });
  }

  // One limit across both rails. Arc's facility is the ledger of record, so a
  // Hedera drawdown spends the same headroom an Arc one would - without this,
  // the line could be drawn down twice, once on each rail.
  const facility = getHumanFacilityStats(human);

  try {
    const res = await fetch(`${HEDERA_PAYER_URL}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, maxCreditUsd: facility.totalAvailableCredit }),
      // A scheduled repayment plus a settlement is several round trips to
      // consensus; this is not a fast path.
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json().catch(() => ({}));

    // Only a drawdown creates debt. An agent paying from its own balance owes
    // nothing and must not consume the human's credit.
    if (res.ok && data?.success && data.fundedBy === "float-credit") {
      openRailDebt({
        humanOwner: human,
        rail: "hedera",
        amountUsd: Number(data.amount) || 0,
        scheduleId: data.scheduledRepayment?.scheduleId,
        resource: url,
      });
      invalidateTelemetryCache(human);
    }

    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Hedera payer unreachable" },
      { status: 502 }
    );
  }
}
