/**
 * Repayment, parked on the network before the money is spent.
 *
 * This is the part of Float that only Hedera can do. Everywhere else, "the
 * borrower will repay on the 30th" is either a keeper bot with a private key
 * and a cron job, or an ERC-20 allowance the borrower can revoke the moment the
 * money lands. Both are promises about future liveness.
 *
 * HIP-423 lets the transfer itself sit on the ledger. The borrower signs once,
 * at drawdown, and the network holds a fully-formed transaction with an
 * execution date on it. Nobody has to be awake on the 30th - not Float, not the
 * borrower, not a bot. When the clock reaches the expiry, consensus executes it.
 *
 * What it is not: a guarantee of funds. If the account is empty at expiry the
 * transfer fails, and that failure is exactly the default signal Float wants -
 * observable by anyone watching the schedule, rather than an assertion by the
 * lender.
 */
import {
  Hbar,
  ScheduleCreateTransaction,
  ScheduleDeleteTransaction,
  ScheduleInfoQuery,
  ScheduleSignTransaction,
  Timestamp,
  TransactionId,
  TransferTransaction,
} from "@hiero-ledger/sdk";
import { MIRROR_NODE, USDC, clientFor, operator, parseKey, toUnits, type Identity } from "./config";

/** Hedera caps a long-term schedule at two months out. */
export const MAX_SCHEDULE_SECONDS = 60 * 24 * 60 * 60;

export type ScheduledRepayment = {
  scheduleId: string;
  transactionId: string;
  dueAt: string;
  amount: string;
};

/**
 * The borrower's own public key, read off the network.
 *
 * Needed to tell whether a schedule carries their signature when Float does not
 * hold their key and so cannot derive it. Public by definition - this is only a
 * lookup, not a disclosure.
 */
export async function accountPublicKey(accountId: string): Promise<string | null> {
  const res = await fetch(`${MIRROR_NODE}/api/v1/accounts/${accountId}`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { key?: { key?: string } };
  const hex = body.key?.key;
  return hex ? Buffer.from(hex, "hex").toString("base64") : null;
}

/**
 * Whether a schedule already carries a signature from this key.
 *
 * The mirror reports each signature as a base64 prefix of the public key that
 * made it, so a prefix match is the test. Comparing prefixes rather than whole
 * keys is the mirror's own contract, not a shortcut.
 */
export async function hasSignature(scheduleId: string, publicKeyB64: string): Promise<boolean> {
  const res = await fetch(`${MIRROR_NODE}/api/v1/schedules/${scheduleId}`, { cache: "no-store" });
  if (!res.ok) return false;
  const body = (await res.json()) as { signatures?: { public_key_prefix?: string }[] };
  return (body.signatures ?? []).some((sig) => {
    const p = sig.public_key_prefix ?? "";
    return p.length > 0 && (publicKeyB64.startsWith(p) || p.startsWith(publicKeyB64));
  });
}

/**
 * Waits for the borrower to sign a schedule Float created for them.
 *
 * This is the half that makes custody optional. Float can build the obligation
 * - the amount, the date, the direction - but it is the borrower's signature
 * that makes it binding, and that signature can be sent from their own wallet
 * by anyone holding the key. Float never needs it.
 *
 * The wait is not politeness. An unsigned schedule never executes, so settling
 * with the seller before seeing the signature would leave Float out of pocket
 * against a promise nobody actually made.
 */
export async function awaitSignature(
  scheduleId: string,
  publicKeyB64: string,
  timeoutMs = 120_000,
  pollMs = 3_000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await hasSignature(scheduleId, publicKeyB64)) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

/**
 * Adds a signature to a schedule someone else created.
 *
 * What an agent runs against its own key, from its own machine, to accept an
 * obligation Float proposed. Separated from creation because those are two
 * different parties whenever Float is not the custodian.
 */
export async function signSchedule(scheduleId: string, signer: Identity): Promise<void> {
  const client = clientFor(signer);
  try {
    await new ScheduleSignTransaction()
      .setScheduleId(scheduleId)
      .freezeWith(client)
      .sign(parseKey(signer.key))
      .then((signed) => signed.execute(client))
      .then((r) => r.getReceipt(client));
  } finally {
    client.close();
  }
}

/**
 * Parks a USDC transfer from the borrower to Float, dated at the repayment
 * deadline.
 *
 * `setWaitForExpiry(true)` is what makes this a post-dated cheque rather than a
 * transfer waiting on a missing counter-signature: with every required
 * signature already collected, the network still holds it until the expiry
 * rather than executing at once.
 *
 * Two ways the borrower's signature gets onto it. Float can apply it, which
 * needs their key and is what this demo does; or the borrower applies it from
 * their own wallet and Float waits to see it, which needs nothing from them but
 * the signature itself. The second is the honest arrangement - Float proposes
 * an obligation, the borrower accepts it - and `custody: "borrower"` selects it.
 */
export async function scheduleRepayment(params: {
  borrower: Identity;
  amount: string;
  dueInSeconds: number;
  memo?: string;
  treasury?: string;
  /**
   * "float"    - Float holds the key and signs on the borrower's behalf.
   * "borrower" - the borrower signs from their own wallet; Float only waits.
   */
  custody?: "float" | "borrower";
  /** How long to wait for a borrower-signed schedule before giving up. */
  signatureTimeoutMs?: number;
  /**
   * Called with the schedule id the moment it exists, before any waiting.
   *
   * Without this, asking the borrower to sign is impossible: Float would create
   * an obligation and block on a signature while the only party who could give
   * it has not been told what to sign. This is the handoff - publish it, send
   * it, put it on the topic - and it has to happen before the wait, not after.
   */
  onCreated?: (scheduleId: string) => void | Promise<void>;
}): Promise<ScheduledRepayment> {
  const { borrower, amount, dueInSeconds } = params;
  const custody = params.custody ?? "float";

  if (dueInSeconds <= 0) throw new Error("repayment must be scheduled in the future");
  if (dueInSeconds > MAX_SCHEDULE_SECONDS) {
    throw new Error(`Hedera schedules expire within 2 months; asked for ${dueInSeconds}s`);
  }

  const float = operator();
  const treasury = params.treasury || float.id;
  const units = toUnits(amount);
  const dueAt = new Date(Date.now() + dueInSeconds * 1000);

  // The borrower is the payer of the scheduled transfer, so their signature is
  // the one the network requires before it can execute.
  const inner = new TransferTransaction()
    .addTokenTransfer(USDC, borrower.id, -Number(units))
    .addTokenTransfer(USDC, treasury, Number(units));

  const client = clientFor(float);
  try {
    const create = await new ScheduleCreateTransaction()
      .setScheduledTransaction(inner)
      .setScheduleMemo(params.memo || `Float repayment of ${amount} USDC`)
      .setExpirationTime(Timestamp.fromDate(dueAt))
      .setWaitForExpiry(true)
      .setAdminKey(parseKey(float.key).publicKey)
      .setMaxTransactionFee(new Hbar(5))
      .execute(client);

    const receipt = await create.getReceipt(client);
    const scheduleId = receipt.scheduleId?.toString();
    if (!scheduleId) throw new Error("schedule creation returned no id");

    // Tell the caller before blocking on anything, so whoever has to sign can
    // be told what to sign.
    if (params.onCreated) await params.onCreated(scheduleId);

    // The borrower commits. After this the obligation is the network's to
    // execute, and Float cannot move the date or the amount - only the
    // admin key can delete the schedule outright.
    if (custody === "float") {
      await new ScheduleSignTransaction()
        .setScheduleId(scheduleId)
        .freezeWith(client)
        .sign(parseKey(borrower.key))
        .then((signed) => signed.execute(client))
        .then((r) => r.getReceipt(client));
    } else {
      const pub = await accountPublicKey(borrower.id);
      if (!pub) throw new Error(`could not read the public key of ${borrower.id}`);

      const signed = await awaitSignature(scheduleId, pub, params.signatureTimeoutMs ?? 120_000);
      if (!signed) {
        // Nothing was promised, so nothing is owed - and the schedule is torn
        // up rather than left parked, because an unsigned one that lingers
        // would look like an obligation to anyone reading the ledger.
        await cancelRepayment(scheduleId);
        throw new Error(
          `${borrower.id} did not sign schedule ${scheduleId} in time. ` +
            `Nothing was paid and the schedule has been deleted.`
        );
      }
    }

    return {
      scheduleId,
      transactionId: create.transactionId.toString(),
      dueAt: dueAt.toISOString(),
      amount,
    };
  } finally {
    client.close();
  }
}

/**
 * Settle a parked repayment early, and tear up the cheque.
 *
 * Without this, paying early means paying twice. The schedule does not care
 * that the debt is gone - it fires on its date and takes the money again, and
 * the borrower has no way to stop it: Float holds the admin key, not them.
 *
 * Order matters. The transfer goes first, so a failure leaves the obligation
 * standing rather than deleting it and hoping. Deleting first and failing to
 * collect would discharge a debt that was never paid.
 */
export async function settleEarly(params: {
  borrower: Identity;
  amount: string;
  scheduleId: string;
  treasury?: string;
}): Promise<{ transactionId: string; scheduleDeleted: boolean }> {
  const float = operator();
  const treasury = params.treasury || float.id;
  const units = toUnits(params.amount);

  // Float pays the network fee, the borrower signs the debit.
  //
  // Agents are minted with no HBAR on purpose - Blocky402 is the fee payer on
  // every x402 settlement, so an agent on this rail never needs gas. Early
  // repayment is a plain transfer with no facilitator in it, so left alone the
  // agent would be the fee payer and the whole thing dies on
  // INSUFFICIENT_PAYER_BALANCE with USDC sitting right there. Naming Float as
  // the payer keeps that promise consistent: the agent authorises what leaves
  // its account, and never has to hold gas to do it.
  const client = clientFor(float);
  let transactionId: string;
  try {
    const frozen = new TransferTransaction()
      .addTokenTransfer(USDC, params.borrower.id, -Number(units))
      .addTokenTransfer(USDC, treasury, Number(units))
      .setTransactionMemo(`Float early repayment of ${params.amount} USDC`)
      .setTransactionId(TransactionId.generate(float.id))
      .freezeWith(client);

    // Debiting the borrower needs the borrower's signature; Float's is added on
    // execute as the fee payer.
    const signed = await frozen.sign(parseKey(params.borrower.key));
    const transfer = await signed.execute(client);

    await transfer.getReceipt(client);
    transactionId = transfer.transactionId.toString();
  } finally {
    client.close();
  }

  return { transactionId, scheduleDeleted: await cancelRepayment(params.scheduleId) };
}

/**
 * Deletes a parked repayment.
 *
 * Only the admin key can do this, and Float holds it - which is the asymmetry
 * that makes settling early Float's responsibility rather than the borrower's
 * option. A schedule that has already executed or expired is gone from state
 * and cannot be deleted; that is reported rather than thrown.
 */
export async function cancelRepayment(scheduleId: string): Promise<boolean> {
  const float = operator();
  const client = clientFor(float);
  try {
    await new ScheduleDeleteTransaction()
      .setScheduleId(scheduleId)
      .freezeWith(client)
      .sign(parseKey(float.key))
      .then((signed) => signed.execute(client))
      .then((r) => r.getReceipt(client));
    return true;
  } catch (err: any) {
    console.warn(`[Scheduled] Could not delete ${scheduleId}: ${err?.message || err}`);
    return false;
  } finally {
    client.close();
  }
}

/**
 * What the network currently thinks of a parked repayment.
 *
 * Only valid while the schedule is still in state. Once it executes, Hedera
 * drops the entity and this throws INVALID_SCHEDULE_ID - use
 * `scheduleStatus` from ./mirror for anything that has to survive execution.
 */
export async function inspect(scheduleId: string) {
  const client = clientFor(operator());
  try {
    const info = await new ScheduleInfoQuery().setScheduleId(scheduleId).execute(client);
    return {
      scheduleId,
      memo: info.scheduleMemo,
      expirationTime: info.expirationTime?.toDate().toISOString() ?? null,
      executed: info.executed?.toDate().toISOString() ?? null,
      deleted: info.deleted?.toDate().toISOString() ?? null,
      waitForExpiry: info.waitForExpiry,
    };
  } finally {
    client.close();
  }
}
