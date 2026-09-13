import { NextRequest, NextResponse } from "next/server";
import { getHuman, unauthenticated } from "@/lib/session";
import { HEDERA_PAYER_URL } from "@/lib/rails";

/** Whether the Hedera rail can be used right now, and what it sells. */
export async function GET(req: NextRequest) {
  if (!getHuman(req)) return unauthenticated();

  try {
    const [statusRes, catRes] = await Promise.all([
      fetch(`${HEDERA_PAYER_URL}/status`, { headers: { "x-float-payer-secret": process.env.FLOAT_PAYER_SECRET ?? "" }, cache: "no-store", signal: AbortSignal.timeout(5000) }),
      fetch(`${HEDERA_PAYER_URL}/catalogue`, { headers: { "x-float-payer-secret": process.env.FLOAT_PAYER_SECRET ?? "" }, cache: "no-store", signal: AbortSignal.timeout(5000) }),
    ]);
    if (!statusRes.ok) throw new Error(`payer returned ${statusRes.status}`);

    const status = await statusRes.json();
    const catalogue = catRes.ok ? await catRes.json() : { resources: [] };

    return NextResponse.json({
      ...status,
      base: catalogue.base ?? null,
      resources: catalogue.resources ?? [],
    });
  } catch (err: any) {
    // Reachability is the answer, not an error. The UI offers the rail only
    // when it can actually be used.
    return NextResponse.json({
      rail: "hedera",
      configured: false,
      sellerUp: false,
      reachable: false,
      resources: [],
      error: err?.message ?? "payer unreachable",
    });
  }
}
