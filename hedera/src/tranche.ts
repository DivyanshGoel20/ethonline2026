/**
 * One parked repayment, drawn against many times.
 *
 * The per-payment schedule was the same mistake Arc made with per-drawdown
 * storage writes: a 0.005 USDC purchase cost two consensus transactions to
 * promise 0.005 USDC back. The obligation was more expensive than the loan.
 *
 * A tranche fixes the ratio without weakening the guarantee. Float parks ONE
 * schedule for a ceiling - say 0.50 USDC - signed by the borrower up front, and
 * then settles x402 payments against it until the ceiling is reached. The
 * promise still precedes the spending, which is the whole argument for doing
 * this on Hedera; it is just made once for a hundred payments instead of once
 * each.
 *
 *   park 0.50 ceiling      2 transactions
 *   100 payments of 0.005  0 additional
 *   close at true amount   2 transactions
 *
 * versus 200 for the same hundred payments parked individually.
 *
 * The honest cost: a tranche that is never closed collects its ceiling rather
 * than what was drawn. That is why closing is part of the flow and not a
 * cleanup step - `closeTranche` transfers the true amount and deletes the
 * schedule, using the same early-settlement path a borrower uses. Size the
 * ceiling to expected spending and close when the agent stops.
 */
import fs from "node:fs";
import path from "node:path";
import { cancelRepayment, scheduleRepayment, settleEarly } from "./scheduled";
import { borrower as defaultBorrower, fromUnits, toUnits, type Identity } from "./config";
import { identityFor } from "./agentWallets";

export interface Tranche {
  scheduleId: string;
  borrowerId: string;
  /** What the borrower signed for. The schedule is parked for this amount. */
  ceilingUsd: number;
  /** What has actually been spent against it. Never exceeds the ceiling. */
  drawnUsd: number;
  dueAt: string;
  createdAt: number;
  status: "open" | "closed" | "exhausted";
  closedAt?: number;
  closedTransactionId?: string;
  /** Every resource this tranche paid for, so a line item can be traced back. */
  draws: { resource: string; amountUsd: number; at: number }[];
}

const FILE = path.resolve(process.cwd(), "hedera", "data", "tranches.json");

/** Default ceiling. Overridable so a demo can show the roll-over in one run. */
export const DEFAULT_CEILING_USD = Number(process.env.FLOAT_TRANCHE_CEILING || 0.5);

function readAll(): Tranche[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: Tranche[]): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

/** Rounded to USDC's six decimals, so repeated addition cannot drift. */
const round6 = (n: number): number => Number(n.toFixed(6));

/**
 * A tranche is only usable while it is open, has room, and has not passed its
 * date - after that consensus has already run it and the schedule is gone.
 */
export function isUsable(t: Tranche, amountUsd: number): boolean {
  return (
    t.status === "open" &&
    new Date(t.dueAt).getTime() > Date.now() &&
    round6(t.drawnUsd + amountUsd) <= t.ceilingUsd
  );
}

export function openTranches(borrowerId?: string): Tranche[] {
  return readAll().filter(
    (t) => t.status === "open" && (!borrowerId || t.borrowerId === borrowerId)
  );
}

export function findTranche(scheduleId: string): Tranche | undefined {
  return readAll().find((t) => t.scheduleId === scheduleId);
}

/**
 * Charge a payment to a tranche, parking a new one first if nothing open can
 * cover it.
 *
 * The ceiling is raised to the payment when a single purchase is larger than
 * the default - a 2.00 USDC call cannot be squeezed into a 0.50 tranche, and
 * refusing it would make batching a restriction on what an agent may buy.
 */
export async function drawOnTranche(params: {
  amountUsd: number;
  resource: string;
  dueInSeconds: number;
  borrower?: Identity;
  ceilingUsd?: number;
  /** Passed through: a tranche is one schedule, signed the same two ways. */
  custody?: "float" | "borrower";
  onCreated?: (scheduleId: string) => void | Promise<void>;
}): Promise<{ tranche: Tranche; parkedNow: boolean }> {
  const who = params.borrower ?? defaultBorrower();
  const amount = round6(params.amountUsd);

  const existing = readAll().find((t) => t.borrowerId === who.id && isUsable(t, amount));
  if (existing) {
    return { tranche: applyDraw(existing.scheduleId, amount, params.resource), parkedNow: false };
  }

  const ceiling = round6(Math.max(params.ceilingUsd ?? DEFAULT_CEILING_USD, amount));

  const parked = await scheduleRepayment({
    borrower: who,
    amount: fromUnits(toUnits(ceiling.toFixed(6))),
    dueInSeconds: params.dueInSeconds,
    memo: `Float tranche, ceiling ${ceiling.toFixed(6)} USDC`,
    custody: params.custody,
    onCreated: params.onCreated,
  });

  const row: Tranche = {
    scheduleId: parked.scheduleId,
    borrowerId: who.id,
    ceilingUsd: ceiling,
    drawnUsd: 0,
    dueAt: parked.dueAt,
    createdAt: Date.now(),
    status: "open",
    draws: [],
  };
  writeAll([...readAll(), row]);

  return { tranche: applyDraw(row.scheduleId, amount, params.resource), parkedNow: true };
}

/** Records a draw and marks the tranche exhausted once the ceiling is reached. */
function applyDraw(scheduleId: string, amountUsd: number, resource: string): Tranche {
  const all = readAll();
  const row = all.find((t) => t.scheduleId === scheduleId);
  if (!row) throw new Error(`no such tranche ${scheduleId}`);

  row.drawnUsd = round6(row.drawnUsd + amountUsd);
  row.draws.push({ resource, amountUsd, at: Date.now() });
  if (row.drawnUsd >= row.ceilingUsd) row.status = "exhausted";

  writeAll(all);
  return row;
}

/**
 * Settle a tranche for what was actually drawn, and tear up the cheque.
 *
 * The transfer goes first and the schedule is deleted only once it lands - the
 * other order discharges a debt that was never collected. A tranche that was
 * never drawn is not settled at all: there is nothing to collect, so the
 * schedule is simply deleted.
 */
export async function closeTranche(
  scheduleId: string,
  opts?: { borrower?: Identity }
): Promise<{ tranche: Tranche; transactionId: string | null; scheduleDeleted: boolean }> {
  const row = findTranche(scheduleId);
  if (!row) throw new Error(`no such tranche ${scheduleId}`);
  if (row.status === "closed") throw new Error(`tranche ${scheduleId} is already closed`);

  /**
   * The account that drew the credit is the account that settles it.
   *
   * This fell back to the configured borrower, so closing a tranche belonging
   * to an agent debited Float's own default account instead - the agent's debt
   * was quietly paid by someone else, which is the "Float owing Float" problem
   * reappearing at the other end of the loan. Verified the hard way: a close
   * for 0.015 drawn by 0.0.10522992 came out of 0.0.10509545.
   *
   * A borrower Float does not custody cannot be closed this way at all. The
   * settlement is a plain transfer out of their account and only they can
   * authorise it, so Float has nothing to sign with - and moving the amount
   * from any account it *can* sign for would be the same bug again.
   */
  const who =
    opts?.borrower ??
    identityFor(row.borrowerId) ??
    (row.borrowerId === defaultBorrower().id ? defaultBorrower() : null);

  if (!who) {
    throw new Error(
      `Float holds no key for ${row.borrowerId}, so it cannot settle this tranche on their ` +
        `behalf. The borrower settles it themselves, or it executes at its ceiling on ${row.dueAt}.`
    );
  }

  let transactionId: string | null = null;
  let scheduleDeleted: boolean;

  if (row.drawnUsd > 0) {
    const result = await settleEarly({
      borrower: who,
      amount: row.drawnUsd.toFixed(6),
      scheduleId,
    });
    transactionId = result.transactionId;
    scheduleDeleted = result.scheduleDeleted;
  } else {
    scheduleDeleted = await cancelRepayment(scheduleId);
  }

  const all = readAll();
  const stored = all.find((t) => t.scheduleId === scheduleId)!;
  stored.status = "closed";
  stored.closedAt = Date.now();
  if (transactionId) stored.closedTransactionId = transactionId;
  writeAll(all);

  return { tranche: stored, transactionId, scheduleDeleted };
}
