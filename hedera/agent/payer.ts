/**
 * The agent that spends, and the credit line that covers it when it cannot.
 *
 * The sequence is the point. An agent hits a metered endpoint, gets a 402 with
 * a price it cannot cover, and rather than failing the call, Float steps in:
 *
 *   1. read the quote            - what does this actually cost?
 *   2. check the agent's balance - can it pay for itself?
 *   3. if not, park the repayment on Hedera BEFORE spending a cent
 *   4. settle the invoice from Float's treasury
 *   5. write both facts to the HCS trail
 *
 * Step 3 is deliberately ahead of step 4. The obligation exists on the ledger
 * before the money moves, so there is no window in which Float has paid and
 * holds nothing but a promise. On a chain without scheduled transactions that
 * ordering is not available: the best you get is an allowance the borrower can
 * revoke the moment the goods arrive.
 */
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";

import { NETWORK, agent, borrower, fromUnits, operator, optionalTopicId, parseKey, type Identity } from "../src/config";
import { usdcBalance } from "../src/mirror";
import { scheduleRepayment, type ScheduledRepayment } from "../src/scheduled";
import { drawOnTranche, type Tranche } from "../src/tranche";
import { append } from "../src/hcs";

/** Repayment falls due this far after the drawdown. */
const TERM_SECONDS = Number(process.env.FLOAT_TERM_SECONDS || 7 * 24 * 60 * 60);

export type Receipt = {
  fundedBy: "agent" | "float-credit";
  amount: string;
  data: unknown;
  transactionId?: string;
  scheduledRepayment?: ScheduledRepayment;
  /**
   * The tranche this drawdown was charged to, when batching is on. The
   * obligation still precedes the spending - it was parked when the tranche
   * opened, which may have been a hundred payments ago.
   */
  tranche?: { scheduleId: string; ceilingUsd: number; drawnUsd: number; dueAt: string; parkedNow: boolean };
  trail?: { transactionId: string; sequenceNumber: string }[];
};

/**
 * Whether to park one schedule per payment or draw on a tranche.
 *
 * Off by default so the per-payment path stays the demonstrated one, and
 * because a tranche's ceiling is only right when someone has chosen it.
 * FLOAT_TRANCHE_CEILING sizes it; see src/tranche.ts for the trade.
 */
const BATCHING = process.env.FLOAT_TRANCHE_BATCHING === "true";

/**
 * The agent's per-payment ceiling.
 *
 * x402 defaults to $1, which is a sensible default for an autonomous buyer and
 * too low to exercise Float: a charge has to be a real fraction of the credit
 * line before the decision to lend is interesting. Raised rather than disabled,
 * because an agent with no spending cap is the thing this product exists to
 * make safe. $5 matches the largest resource on the Arc rail.
 */
const MAX_PER_PAYMENT = process.env.FLOAT_MAX_PER_PAYMENT || "$5.00";

function payingFetch(as: Identity) {
  const signer = createClientHederaSigner(as.id, parseKey(as.key), { network: NETWORK });
  // setSpendControls, not a constructor option: the constructor's only argument
  // is a payment-requirements selector, so an options object there is accepted
  // and ignored, leaving the $1 default silently in place.
  const client = new x402Client()
    .setSpendControls({ maxAmountPerPayment: MAX_PER_PAYMENT })
    .register("hedera:*", new ExactHederaScheme(signer));
  return wrapFetchWithPayment(fetch, client);
}

/**
 * Asks the resource what it wants without paying, so the funding decision is
 * made against a real quote rather than an assumption about price.
 */
async function quote(url: string): Promise<{ amount: bigint; raw: any } | null> {
  const res = await fetch(url);
  if (res.status !== 402) return null;

  // The requirements ride in the PAYMENT-REQUIRED header, not the body - the
  // body is whatever preview the server chose to show a non-paying caller.
  const header = res.headers.get("payment-required");
  if (!header) return null;

  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return null;
  }

  const accepts: any[] = payload?.accepts ?? [];
  const option = accepts.find((a) => a?.network === NETWORK) ?? accepts[0];
  if (!option) return null;

  return { amount: BigInt(option.amount ?? option.maxAmountRequired ?? "0"), raw: option };
}

export async function payForResource(
  url: string,
  opts?: {
    /**
     * The human's remaining credit on Arc. Float declines to step in beyond it.
     * Arc is the facility of record for both rails, so a Hedera drawdown has to
     * respect the same limit an Arc one would - otherwise the line can be spent
     * twice, once on each rail.
     */
    maxCreditUsd?: number;
  }
): Promise<Receipt> {
  const buyer = agent();
  const float = operator();
  const topic = optionalTopicId();
  const trail: Receipt["trail"] = [];

  const q = await quote(url);
  if (!q) {
    // Nothing to pay for - either it is free or the server is not gating it.
    const res = await fetch(url);
    return { fundedBy: "agent", amount: "0.000000", data: await res.json() };
  }

  const price = q.amount;
  const balance = await usdcBalance(buyer.id);
  const canSelfFund = balance >= price;

  console.log(`  quote     ${fromUnits(price)} USDC`);
  console.log(`  agent has ${fromUnits(balance)} USDC -> ${canSelfFund ? "pays for itself" : "short, drawing on Float"}`);

  let scheduled: ScheduledRepayment | undefined;
  let drawnTranche: Receipt["tranche"];

  if (!canSelfFund) {
    const priceUsd = Number(fromUnits(price));
    if (opts?.maxCreditUsd !== undefined && priceUsd > opts.maxCreditUsd) {
      // Whatever bound here - the human's remaining headroom, or the smaller cap
      // on an agent's mandate - arrives as one number, so the wording has to
      // cover both. Six places, because a 0.004 allowance printed to two said
      // "0.00" and read like the line was exhausted when it was not.
      throw new Error(
        `Float credit declined: ${fromUnits(price)} USDC exceeds the credit ` +
          `allowance of ${opts.maxCreditUsd.toFixed(6)} USDC available to this caller.`
      );
    }

    // The borrower commits to repayment before Float is out of pocket.
    const who = borrower();

    if (BATCHING) {
      const { tranche: t, parkedNow } = await drawOnTranche({
        amountUsd: Number(fromUnits(price)),
        resource: url,
        dueInSeconds: TERM_SECONDS,
        borrower: who,
      });
      drawnTranche = { scheduleId: t.scheduleId, ceilingUsd: t.ceilingUsd, drawnUsd: t.drawnUsd, dueAt: t.dueAt, parkedNow };
      scheduled = { scheduleId: t.scheduleId, transactionId: "", dueAt: t.dueAt, amount: fromUnits(price) };

      console.log(
        parkedNow
          ? `  parked tranche ${t.scheduleId} ceiling ${t.ceilingUsd.toFixed(6)} due ${t.dueAt}`
          : `  drew on tranche ${t.scheduleId}, ${t.drawnUsd.toFixed(6)}/${t.ceilingUsd.toFixed(6)} used - no new schedule`
      );
    } else {
      scheduled = await scheduleRepayment({
        borrower: who,
        amount: fromUnits(price),
        dueInSeconds: TERM_SECONDS,
        memo: `Float drawdown for ${new URL(url).pathname}`,
      });

      console.log(`  scheduled repayment ${scheduled.scheduleId} due ${scheduled.dueAt}`);
    }

    if (topic) {
      try {
        trail.push(
          await append(topic, {
            kind: "drawdown",
            agent: buyer.id,
            human: who.id,
            amount: fromUnits(price),
            scheduleId: scheduled.scheduleId,
            dueAt: scheduled.dueAt,
          })
        );
      } catch (err: any) {
        // An audit write must never undo a drawdown that already happened.
        console.warn(`  trail write failed (drawdown): ${err?.message || err}`);
      }
    }
  }

  // Whoever is funding it signs the transfer; Blocky402 counter-signs as fee
  // payer and submits, so neither the agent nor Float needs HBAR for gas.
  const paid = await payingFetch(canSelfFund ? buyer : float)(url);
  if (!paid.ok) {
    throw new Error(`resource returned ${paid.status} after payment: ${await paid.text()}`);
  }

  const settlement = paid.headers.get("payment-response") || paid.headers.get("x-payment-response");
  let transactionId: string | undefined;
  if (settlement) {
    try {
      transactionId = JSON.parse(Buffer.from(settlement, "base64").toString("utf8"))?.transaction;
    } catch {
      /* header shape is facilitator-specific; the data below is the real proof */
    }
  }

  const data = await paid.json();

  if (topic) {
    try {
      trail.push(
        await append(topic, {
          kind: "payment",
          agent: buyer.id,
          resource: url,
          amount: fromUnits(price),
          transactionId: transactionId ?? "(not reported)",
        })
      );
    } catch (err: any) {
      console.warn(`  trail write failed (payment): ${err?.message || err}`);
    }
  }

  return {
    fundedBy: canSelfFund ? "agent" : "float-credit",
    amount: fromUnits(price),
    data,
    transactionId,
    scheduledRepayment: scheduled,
    tranche: drawnTranche,
    trail,
  };
}
