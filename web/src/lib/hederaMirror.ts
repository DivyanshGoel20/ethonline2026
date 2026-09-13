/**
 * Just enough Hedera to reconcile a parked repayment.
 *
 * Plain REST against the Mirror Node, deliberately: the payer service owns the
 * SDK and the keys, and dragging either into the web app to answer "did that
 * schedule run" would be the worse trade. Reading public history needs neither.
 */
const MIRROR = process.env.HEDERA_MIRROR_URL || "https://testnet.mirrornode.hedera.com";

export type ScheduleOutcome =
  | { state: "pending" }
  | { state: "settled"; executedAt: string; transactionId?: string }
  /** Ran, and moved nothing - the borrower could not cover it. */
  | { state: "defaulted"; executedAt: string; reason: string }
  | { state: "unknown"; reason: string };

const toIso = (stamp?: string | null): string =>
  stamp ? new Date(Number(stamp.split(".")[0]) * 1000).toISOString() : "";

/**
 * What became of a schedule.
 *
 * The subtlety that makes this necessary: a schedule whose transfer fails is
 * still stamped executed. Asking only "did it execute" reports a default as a
 * repayment. So the consensus result behind the execution has to be read too -
 * a failed one moved nothing, and the debt still stands.
 */
export async function scheduleOutcome(scheduleId: string): Promise<ScheduleOutcome> {
  let executedAt: string;
  try {
    const res = await fetch(`${MIRROR}/api/v1/schedules/${scheduleId}`, { cache: "no-store" });
    if (res.status === 404) return { state: "unknown", reason: "no such schedule" };
    if (!res.ok) return { state: "unknown", reason: `mirror returned ${res.status}` };

    const body = (await res.json()) as { executed_timestamp?: string | null; deleted?: boolean };
    if (body.deleted) return { state: "unknown", reason: "schedule was deleted" };
    if (!body.executed_timestamp) return { state: "pending" };
    executedAt = body.executed_timestamp;
  } catch (err: any) {
    return { state: "unknown", reason: err?.message ?? "mirror unreachable" };
  }

  try {
    const res = await fetch(`${MIRROR}/api/v1/transactions?timestamp=${executedAt}`, {
      cache: "no-store",
    });
    if (!res.ok) return { state: "unknown", reason: `mirror returned ${res.status}` };

    const body = (await res.json()) as {
      transactions?: { result?: string; transaction_id?: string; scheduled?: boolean }[];
    };
    const tx = (body.transactions ?? []).find((t) => t.scheduled) ?? body.transactions?.[0];
    if (!tx) return { state: "unknown", reason: "no transaction at that consensus time" };

    return tx.result === "SUCCESS"
      ? { state: "settled", executedAt: toIso(executedAt), transactionId: tx.transaction_id }
      : { state: "defaulted", executedAt: toIso(executedAt), reason: tx.result ?? "unknown result" };
  } catch (err: any) {
    return { state: "unknown", reason: err?.message ?? "mirror unreachable" };
  }
}
