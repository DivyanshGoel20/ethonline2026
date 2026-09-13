import { NextRequest, NextResponse } from "next/server";
import { getHuman, unauthenticated } from "@/lib/session";
import { HEDERA_PAYER_URL } from "@/lib/rails";

/**
 * Settle a parked repayment before its date.
 *
 * Without this the only way to repay was to wait: the schedule fired on its own
 * and anyone who paid early paid twice, because nothing tore up the cheque.
 */
export async function POST(req: NextRequest) {
  if (!getHuman(req)) return unauthenticated();

  const { scheduleId } = await req.json().catch(() => ({ scheduleId: "" }));
  if (!scheduleId) {
    return NextResponse.json({ success: false, error: "Missing scheduleId" }, { status: 400 });
  }

  try {
    const res = await fetch(`${HEDERA_PAYER_URL}/repay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId }),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Hedera payer unreachable" },
      { status: 502 }
    );
  }
}
