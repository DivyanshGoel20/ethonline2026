import { NextRequest, NextResponse } from "next/server";
import { getHuman, unauthenticated } from "@/lib/session";
import { mintAgentToken } from "@/lib/agentToken";
import { getHumanFacilityStats } from "@/lib/agentStore";
import { HEDERA_PAYER_URL } from "@/lib/rails";

/**
 * Give a verified human a working agent, in one act.
 *
 * Mint it a Hedera wallet, register it against this human, and hand back the
 * mandate it spends under. Verifying with World is the authorisation: the
 * person who owns the credit line is the person creating the thing that will
 * draw on it, and the token they get back is the card.
 *
 * The wallet is minted by the payer service rather than here, because that is
 * where the Hedera SDK and the operator key live. This route is the policy
 * half: it decides whose agent it is and how much it may spend.
 */
export async function POST(req: NextRequest) {
  const human = getHuman(req);
  if (!human) return unauthenticated();

  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "agent";
  const days = Number.isFinite(body.days) ? Math.min(Math.max(Number(body.days), 1), 90) : 7;

  const facility = getHumanFacilityStats(human);
  const asked = Number.isFinite(body.capUsd) ? Number(body.capUsd) : facility.totalAvailableCredit;
  const capUsd = Math.min(Math.max(asked, 0), facility.totalAvailableCredit);

  if (!(capUsd > 0)) {
    return NextResponse.json(
      { error: "No credit headroom to delegate.", code: "no_headroom" },
      { status: 409 }
    );
  }

  let wallet: { id: string; evmAddress: string };
  try {
    const res = await fetch(`${HEDERA_PAYER_URL}/provision-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-float-payer-secret": process.env.FLOAT_PAYER_SECRET ?? "",
      },
      body: JSON.stringify({ humanOwner: human, label }),
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.wallet?.id) {
      throw new Error(data?.error || `payer returned ${res.status}`);
    }
    wallet = data.wallet;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Could not mint an agent wallet" },
      { status: 502 }
    );
  }

  const { token, grant } = mintAgentToken(human, {
    capUsd,
    days,
    label,
    hederaAccountId: wallet.id,
  });

  return NextResponse.json({
    success: true,
    agent: {
      hederaAccountId: wallet.id,
      // Same key on the other rail, so this is one agent rather than two that
      // happen to be operated together.
      evmAddress: wallet.evmAddress,
      label,
    },
    grant,
    token,
    notice:
      "The token is shown once and not stored. This agent borrows against your line up to " +
      "the cap, and its own wallet is what the repayment debits - so it owes, not Float.",
  });
}
