import { NextRequest, NextResponse } from "next/server";
import { getHuman, unauthenticated } from "@/lib/session";
import { bearerFrom, verifyAgentToken } from "@/lib/agentToken";
import { HEDERA_PAYER_URL } from "@/lib/rails";
import { getHumanFacilityStats } from "@/lib/agentStore";
import { openRailDebt } from "@/lib/railDebt";
import { invalidateTelemetryCache } from "@/lib/telemetryCache";

/**
 * Buy something on the Hedera rail.
 *
 * Gated on a verified human. The agent that spends is named where the caller
 * can name one - by Hedera id from a mandate, by Arc address from the browser -
 * so the repayment parked on consensus is signed by the agent that owes it.
 * Only a caller who names no agent at all falls back to the configured
 * borrower, which is Float promising itself.
 */
export async function POST(req: NextRequest) {
  // Two ways to be a verified human here. A browser carries the session cookie.
  // An agent running outside the browser carries a token its human issued from
  // this same app - which is the authorisation, granted once, rather than a
  // question asked per purchase.
  const grant = verifyAgentToken(bearerFrom(req.headers.get("authorization")));
  const human = getHuman(req) ?? grant?.human ?? null;
  if (!human) return unauthenticated();

  const { url, agentAddress } = await req.json().catch(() => ({ url: "", agentAddress: "" }));
  if (!url) {
    return NextResponse.json({ success: false, error: "Missing resource url" }, { status: 400 });
  }

  // One limit across both rails. Arc's facility is the ledger of record, so a
  // Hedera drawdown spends the same headroom an Arc one would - without this,
  // the line could be drawn down twice, once on each rail.
  const facility = getHumanFacilityStats(human);

  // An agent spends inside its mandate, and the mandate cannot outgrow the line.
  // Whichever is smaller binds.
  const allowance = grant
    ? Math.min(grant.capUsd, facility.totalAvailableCredit)
    : facility.totalAvailableCredit;

  try {
    const res = await fetch(`${HEDERA_PAYER_URL}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-float-payer-secret": process.env.FLOAT_PAYER_SECRET ?? "",
      },
      body: JSON.stringify({
        url,
        maxCreditUsd: allowance,
        // Name the agent so it signs its own repayment. A mandate carries the
        // Hedera id directly; a browser knows the same agent only by its Arc
        // address, which the payer resolves to the same wallet because one key
        // derives both. Naming it either way is what keeps the obligation the
        // agent's own rather than Float promising itself something.
        ...(grant?.hederaAccountId
          ? { borrowerId: grant.hederaAccountId }
          : agentAddress
            ? { agentEvmAddress: agentAddress, humanOwner: human }
            : {}),
      }),
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
        // A batched draw parks a tranche rather than its own schedule, so the
        // id lives somewhere else on the receipt. Missing it here would leave
        // the debt with nothing to point at, and the schedules view - which
        // matches on this id to decide whose obligation is whose - would hide
        // the borrower's own repayment from them.
        scheduleId: data.scheduledRepayment?.scheduleId ?? data.tranche?.scheduleId,
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
