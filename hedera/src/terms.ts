/**
 * What borrowing on this rail actually costs, and the check that happens before
 * an agent is allowed to do it.
 *
 * This exists because an agent was handed the rail and objected to it. Given a
 * wallet and a goal, it bought data, discovered afterwards that its empty wallet
 * had been covered by a third party, and wrote: "the decision to incur debt in
 * your name was made by the tooling, not by me, and I only learned the terms
 * after the debt existed." It was right. A purchase silently became a loan, the
 * terms were never stated, there was no way to decline, and nothing bounded how
 * much a single call could borrow.
 *
 * So: terms are declared up front, borrowing is refused unless the caller asks
 * for it in so many words, and a call cannot exceed a cap it did not set.
 */
import { NETWORK, agent, borrower, fromUnits, toUnits } from "./config";
import { usdcBalance } from "./mirror";

/** Interest and fees, in full. There are none - a drawdown repays its principal. */
export const FEE_USDC = 0;
export const INTEREST_RATE = 0;

/** How long a drawdown runs before the parked repayment comes due. */
export const TERM_SECONDS = Number(process.env.FLOAT_TERM_SECONDS || 7 * 24 * 60 * 60);

/**
 * The most a single call may borrow without the caller naming a higher number.
 * Previously unbounded, which meant `records=25` borrowed five times what
 * `records=5` did and nothing anywhere said so.
 */
export const DEFAULT_CREDIT_CAP_USDC = Number(process.env.FLOAT_DEFAULT_CREDIT_CAP || 0.5);

const days = (s: number) => (s / 86400).toFixed(s % 86400 === 0 ? 0 : 2);

/**
 * The terms, as prose an agent can read before it commits to anything.
 *
 * The default paragraph is not a guess. A borrower with an empty account was
 * parked a 0.05 USDC repayment due in ninety seconds (schedule 0.0.10520758):
 * at maturity consensus ran it and the result was INSUFFICIENT_TOKEN_BALANCE
 * with zero transfers, while the schedule stayed stamped executed. So a default
 * is not an error anyone reports - it is a schedule that ran and moved nothing.
 */
export function termsText(principalUsdc?: string): string {
  const principal = principalUsdc ? `${principalUsdc} USDC` : "the shortfall";

  // Resolved, never assumed. An earlier version of this text asserted that the
  // borrower was the Float facility account - which describes config's fallback,
  // not this deployment, where HEDERA_BORROWER_ID names a third account
  // entirely. An agent reading that disclosure would have had the counterparty
  // wrong, which is the one thing a disclosure must never do.
  let liable = "(not configured)";
  let caller = "(unknown)";
  try {
    liable = borrower().id;
  } catch {
    /* terms are readable even when the rail is half-configured */
  }
  try {
    caller = agent().id;
  } catch {
    /* same */
  }

  return [
    `Float credit terms`,
    ``,
    `  Principal   ${principal}, being only what your wallet could not cover.`,
    `  Fee         ${FEE_USDC.toFixed(2)} USDC. There is no origination fee.`,
    `  Interest    ${INTEREST_RATE}%. You repay exactly the principal.`,
    `  Term        ${days(TERM_SECONDS)} days from the drawdown.`,
    `  Cap         ${DEFAULT_CREDIT_CAP_USDC.toFixed(2)} USDC per call unless you raise it.`,
    ``,
    `How repayment happens`,
    `  A transfer is parked on ${NETWORK} before the invoice is paid, signed by the`,
    `  borrower account and dated at the end of the term. At maturity consensus`,
    `  executes it without anyone being online. You cannot be charged early, and`,
    `  the amount cannot be changed after it is parked.`,
    ``,
    `If the borrower cannot pay at maturity`,
    `  The transfer fails with INSUFFICIENT_TOKEN_BALANCE and moves nothing, while`,
    `  the schedule is still marked executed. Nothing is seized and no penalty is`,
    `  charged. The unpaid drawdown stays visible on the schedule and on the HCS`,
    `  trail, which is what a default looks like here - observable, not asserted.`,
    ``,
    `Who is on the hook`,
    `  The repayment is signed by and debited from ${liable}.`,
    `  That is not your wallet (${caller}), and it may not be you at all.`,
    `  In this deployment the borrower is a separate account whose key Float holds,`,
    `  so authorising here commits an account other than your own. Float never sees`,
    `  that key in a real deployment - the borrower signs for themselves, and the`,
    `  party accepting these terms is the party that owes. Here they are not the`,
    `  same, and you should weigh that before agreeing.`,
  ].join("\n");
}

export type Preflight = {
  priceUsdc: string;
  balanceUsdc: string;
  needsCredit: boolean;
  shortfallUsdc: string;
  withinCap: boolean;
  capUsdc: number;
};

/**
 * Reads the 402 without paying it, so the funding decision is made against a
 * real quote. The requirements are in the PAYMENT-REQUIRED header; the body is
 * whatever preview the seller chose to show a non-paying caller.
 */
export async function quoteFor(url: string): Promise<bigint | null> {
  const res = await fetch(url);
  if (res.status !== 402) return null;

  const header = res.headers.get("payment-required");
  if (!header) return null;

  try {
    const payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    const accepts: any[] = payload?.accepts ?? [];
    const option = accepts.find((a) => a?.network === NETWORK) ?? accepts[0];
    if (!option) return null;
    return BigInt(option.amount ?? option.maxAmountRequired ?? "0");
  } catch {
    return null;
  }
}

/** What this call would cost, who would fund it, and whether that is allowed. */
export async function preflight(
  url: string,
  buyerAccountId: string,
  capUsdc = DEFAULT_CREDIT_CAP_USDC
): Promise<Preflight | null> {
  const price = await quoteFor(url);
  if (price === null) return null;

  const balance = await usdcBalance(buyerAccountId);
  const shortfall = price > balance ? price - balance : 0n;

  return {
    priceUsdc: fromUnits(price),
    balanceUsdc: fromUnits(balance),
    needsCredit: shortfall > 0n,
    shortfallUsdc: fromUnits(shortfall),
    withinCap: shortfall <= toUnits(capUsdc.toFixed(6)),
    capUsdc,
  };
}
