/**
 * Spending under a mandate.
 *
 * An agent does not ask Float for credit. It carries a token its human issued
 * after verifying with World, and spends inside the cap that token names. The
 * consent happened once, at issuance, by the person who actually owes the money
 * - which is how a card works, and why an agent is not asked to agree to terms
 * it has no standing to accept.
 *
 * Purchases therefore go through the app rather than straight at the payer: the
 * app is what knows which human the token belongs to, what their Arc headroom
 * is, and where the resulting debt is recorded. The payer only knows how to buy
 * things.
 */
export const APP_URL = process.env.FLOAT_APP_URL || "http://localhost:3000";
export const AGENT_TOKEN = process.env.FLOAT_AGENT_TOKEN?.trim() || "";

export type Mandate = { capUsd: number; label: string; expiresAt: string; human: string };

/** Reads the grant out of the token without verifying it - the app does that. */
export function describeMandate(token = AGENT_TOKEN): Mandate | null {
  if (!token) return null;
  const cut = token.lastIndexOf(".");
  if (cut < 1) return null;
  try {
    const c = JSON.parse(Buffer.from(token.slice(0, cut), "base64url").toString("utf8"));
    if (c?.typ !== "agent" || typeof c.n !== "string") return null;
    return {
      human: c.n,
      capUsd: Number(c.cap),
      label: String(c.lbl ?? ""),
      expiresAt: new Date(Number(c.exp) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export const NO_MANDATE =
  "This agent holds no spending mandate, so it cannot draw on anyone's credit.\n\n" +
  "A human verifies with World ID in the Float app, chooses a cap, and issues a token\n" +
  "(POST /api/agent-token). Set it as FLOAT_AGENT_TOKEN and the agent can spend within\n" +
  "that cap without asking again. Issuing it is the authorisation - there is nothing\n" +
  "for the agent itself to agree to.";

export type PayResult = {
  success?: boolean;
  fundedBy?: string;
  amount?: string;
  data?: unknown;
  transactionId?: string;
  scheduledRepayment?: { scheduleId: string; amount: string; dueAt: string };
  error?: string;
};

/** Buys through the app, which resolves the human and binds the spend to their line. */
export async function payUnderMandate(url: string): Promise<PayResult> {
  const res = await fetch(`${APP_URL}/api/hedera/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AGENT_TOKEN}`,
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(180_000),
  });

  const body = (await res.json().catch(() => ({}))) as PayResult;

  if (res.status === 401) {
    throw new Error(
      "The mandate was rejected - the token is expired, forged, or was issued by a " +
        "different Float instance. Ask your human to issue a fresh one."
    );
  }
  if (!res.ok) throw new Error(body?.error || `the app returned ${res.status}`);
  return body;
}
