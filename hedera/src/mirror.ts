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
