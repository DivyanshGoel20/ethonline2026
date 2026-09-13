import crypto from "node:crypto";
import { signPayload } from "./session";

/**
 * A credential a human issues to their own agent.
 *
 * The question this answers is who is borrowing. Float extends credit to a
 * World-verified human, and an agent spending that line is the whole product -
 * so the agent does not need to consent to anything. The human already did,
 * when they verified and opened the facility. What was missing was any way for
 * an agent running outside the browser to *prove* which human sent it.
 *
 * That is this: a signed bearer token carrying the human's nullifier and a
 * spending cap they chose. It is the card, and issuing it is the authorisation.
 * The agent then spends within a mandate rather than asking permission per
 * purchase, and the party that agreed and the party that owes are the same
 * person again.
 *
 * Signed with the same secret as the session cookie, but stamped with its own
 * type so neither can be replayed as the other - a stolen session cookie must
 * not become a long-lived spending credential.
 */

const TYPE = "agent";

export type AgentGrant = {
  /** World nullifier of the human who issued it. */
  human: string;
  /** Most this agent may borrow, in USDC, across the life of the token. */
  capUsd: number;
  label: string;
  expiresAt: string;
};

type Claims = { typ: string; n: string; cap: number; lbl: string; exp: number };

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o), "utf8").toString("base64url");

export function mintAgentToken(
  human: string,
  opts: { capUsd: number; days: number; label: string }
): { token: string; grant: AgentGrant } {
  const exp = Math.floor(Date.now() / 1000) + Math.round(opts.days * 86400);
  const claims: Claims = {
    typ: TYPE,
    n: human,
    cap: opts.capUsd,
    lbl: opts.label.slice(0, 64),
    exp,
  };
  const payload = b64(claims);
  return {
    token: `${payload}.${signPayload(payload)}`,
    grant: {
      human,
      capUsd: opts.capUsd,
      label: claims.lbl,
      expiresAt: new Date(exp * 1000).toISOString(),
    },
  };
}

/** The grant behind a bearer token, or null if it is forged, expired, or a session cookie. */
export function verifyAgentToken(token: string | undefined | null): AgentGrant | null {
  if (!token) return null;

  const cut = token.lastIndexOf(".");
  if (cut < 1) return null;

  const payload = token.slice(0, cut);
  const mac = Buffer.from(token.slice(cut + 1));
  const expected = Buffer.from(signPayload(payload));

  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(mac, expected)) return null;

  try {
    const c = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Claims;
    if (c.typ !== TYPE) return null;
    if (typeof c.n !== "string" || !c.n) return null;
    if (typeof c.cap !== "number" || !(c.cap > 0)) return null;
    if (typeof c.exp !== "number" || c.exp * 1000 <= Date.now()) return null;

    return {
      human: c.n,
      capUsd: c.cap,
      label: typeof c.lbl === "string" ? c.lbl : "",
      expiresAt: new Date(c.exp * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

/** Pulls a bearer token out of an Authorization header. */
export const bearerFrom = (header: string | null): string | null =>
  header && /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, "").trim() : null;
