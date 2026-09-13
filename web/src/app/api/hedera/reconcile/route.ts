import { NextRequest, NextResponse } from "next/server";
import { getHuman, unauthenticated } from "@/lib/session";
import { reconcileRailDebt } from "@/lib/reconcile";
import { invalidateTelemetryCache } from "@/lib/telemetryCache";

/**
 * Bring this human's books in line with what Hedera actually did.
 *
 * Safe to call as often as you like: it only ever writes an outcome the mirror
 * already reports, and a debt it has closed is not looked at again.
 *
 * Session only. A spending mandate lets an agent spend; it does not let it tell
 * the ledger its debts are paid.
 */
export async function POST(req: NextRequest) {
  const human = getHuman(req);
  if (!human) return unauthenticated();

  const result = await reconcileRailDebt(human);

  if (result.settled.length || result.defaulted.length) {
    invalidateTelemetryCache(human);
  }

  return NextResponse.json({
    success: true,
    checked: result.checked,
    settled: result.settled.map((r) => ({ scheduleId: r.scheduleId, amountUsd: r.amountUsd })),
    defaulted: result.defaulted.map((r) => ({
      scheduleId: r.scheduleId,
      amountUsd: r.amountUsd,
      reason: r.defaultReason,
    })),
    stillPending: result.stillPending,
    unresolved: result.unresolved,
  });
}
