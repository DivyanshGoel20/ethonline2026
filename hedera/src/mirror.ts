/**
 * Reads against the Mirror Node.
 *
 * Balances and token associations come from here rather than from a consensus
 * node: the mirror is the supported surface for account state, and it is what
 * the x402 Hedera scheme's own preflight uses before it will settle.
 */
import { MIRROR_NODE, USDC } from "./config";

type TokenRow = { token_id: string; balance: number };

export async function usdcBalance(accountId: string): Promise<bigint> {
  const url = `${MIRROR_NODE}/api/v1/accounts/${accountId}/tokens?token.id=${USDC}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mirror node returned ${res.status} for ${accountId}`);

  const body = (await res.json()) as { tokens?: TokenRow[] };
  const row = body.tokens?.find((t) => t.token_id === USDC);
  return BigInt(row?.balance ?? 0);
}

export async function hbarBalance(accountId: string): Promise<bigint> {
  const res = await fetch(`${MIRROR_NODE}/api/v1/accounts/${accountId}`);
  if (!res.ok) throw new Error(`mirror node returned ${res.status} for ${accountId}`);
  const body = (await res.json()) as { balance?: { balance?: number } };
  return BigInt(body.balance?.balance ?? 0);
}

export type ScheduleStatus = {
  scheduleId: string;
  executedAt: string | null;
  deleted: boolean;
  waitForExpiry: boolean;
  expirationTime: string | null;
  signatures: number;
  /** False once the network has dropped it from state - i.e. after it ran. */
  liveInState: boolean;
};

const fromConsensusStamp = (s?: string | null): string | null =>
  s ? new Date(Number(s.split(".")[0]) * 1000).toISOString() : null;

/**
 * Schedule state, read from the Mirror Node.
 *
 * Not from a consensus node: Hedera removes a schedule from state the moment it
 * executes, so ScheduleInfoQuery starts failing with INVALID_SCHEDULE_ID at
 * exactly the point you most want an answer. The mirror keeps the history.
 */
export async function scheduleStatus(scheduleId: string): Promise<ScheduleStatus | null> {
  const res = await fetch(`${MIRROR_NODE}/api/v1/schedules/${scheduleId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`mirror node returned ${res.status} for schedule ${scheduleId}`);

  const d = (await res.json()) as any;
  return {
    scheduleId: d.schedule_id,
    executedAt: fromConsensusStamp(d.executed_timestamp),
    deleted: Boolean(d.deleted),
    waitForExpiry: Boolean(d.wait_for_expiry),
    expirationTime: fromConsensusStamp(d.expiration_time),
    signatures: (d.signatures ?? []).length,
    liveInState: !d.executed_timestamp && !d.deleted,
  };
}
