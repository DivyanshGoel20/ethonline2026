import { NextRequest, NextResponse } from "next/server";
import { getHuman, unauthenticated } from "@/lib/session";
import { HEDERA_PAYER_URL } from "@/lib/rails";

/** Repayments currently parked on consensus, so they can be settled early. */
export async function GET(req: NextRequest) {
  if (!getHuman(req)) return unauthenticated();
  try {
    const res = await fetch(`${HEDERA_PAYER_URL}/schedules`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`payer returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ schedules: [], totalUsd: 0 });
  }
}
