import { NextRequest, NextResponse } from "next/server";
import { getHuman, unauthenticated } from "@/lib/session";
import { HEDERA_PAYER_URL } from "@/lib/rails";
import { openRailDebts } from "@/lib/railDebt";

/**
 * Repayments currently parked on consensus, so they can be settled early.
 *
 * Scoped to the human asking. The payer indexes parked repayments by borrower
 * account and has no notion of World identity, so asking it for "the schedules"
 * returns everyone's - this route checked that a human was signed in and then
 * handed back the lot, so one borrower's obligations appeared on another's
 * dashboard, with a settle button next to them.
 *
 * railDebt is what knows whose drawdown each schedule belongs to, because the
 * pay route records it against the session human at the moment of borrowing.
 * A schedule with no row there - parked by calling the payer directly, outside
 * the app - belongs to nobody this route can name, so it is not shown. Hiding
 * an obligation is recoverable; showing someone else's is not.
 */
export async function GET(req: NextRequest) {
  const human = getHuman(req);
  if (!human) return unauthenticated();
  try {
    const res = await fetch(`${HEDERA_PAYER_URL}/schedules`, {
      headers: { "x-float-payer-secret": process.env.FLOAT_PAYER_SECRET ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`payer returned ${res.status}`);

    const body = (await res.json()) as { schedules?: { scheduleId: string; amountUsd: number }[] };
    const mine = new Set(
      openRailDebts(human)
        .map((d) => d.scheduleId)
        .filter((id): id is string => !!id)
    );

    const schedules = (body.schedules ?? []).filter((s) => mine.has(s.scheduleId));
    return NextResponse.json({
      schedules,
      totalUsd: schedules.reduce((n, s) => n + (s.amountUsd || 0), 0),
    });
  } catch {
    return NextResponse.json({ schedules: [], totalUsd: 0 });
  }
}
