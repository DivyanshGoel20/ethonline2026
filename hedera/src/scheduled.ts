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
  ScheduleInfoQuery,
  ScheduleSignTransaction,
  Timestamp,
  TransferTransaction,
} from "@hiero-ledger/sdk";
import { USDC, clientFor, operator, parseKey, toUnits, type Identity } from "./config";

/** Hedera caps a long-term schedule at two months out. */
export const MAX_SCHEDULE_SECONDS = 60 * 24 * 60 * 60;

export type ScheduledRepayment = {
  scheduleId: string;
  transactionId: string;
  dueAt: string;
  amount: string;
};

/**
 * Parks a USDC transfer from the borrower to Float, dated at the repayment
 * deadline.
 *
 * The borrower's key signs here and nowhere else. `setWaitForExpiry(true)` is
 * what makes this a post-dated cheque rather than a transfer waiting on a
 * missing counter-signature: with every required signature already collected,
 * the network still holds it until the expiry rather than executing at once.
 */
export async function scheduleRepayment(params: {
  borrower: Identity;
  amount: string;
  dueInSeconds: number;
  memo?: string;
  treasury?: string;
}): Promise<ScheduledRepayment> {
  const { borrower, amount, dueInSeconds } = params;

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

    // The borrower commits. After this the obligation is the network's to
    // execute, and Float cannot move the date or the amount - only the
    // admin key can delete the schedule outright.
    await new ScheduleSignTransaction()
      .setScheduleId(scheduleId)
      .freezeWith(client)
      .sign(parseKey(borrower.key))
      .then((signed) => signed.execute(client))
      .then((r) => r.getReceipt(client));

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

/** What the network currently thinks of a parked repayment. */
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
