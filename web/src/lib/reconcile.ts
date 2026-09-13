import { scheduleOutcome } from "./hederaMirror";
import {
  markRailDebtDefaulted,
  reconcilableDebts,
  settleRailDebtBySchedule,
  type RailDebt,
} from "./railDebt";

/**
 * Teaching the ledger what the network already did.
 *
 * A parked repayment executes on its own. That is the whole point of it - but it
 * means nothing in Float is watching when it happens, so a debt that consensus
 * collected a week ago still read as outstanding and went on consuming the
 * human's line. Repaying early was the only way the books ever closed.
 *
 * This closes them the other way: for each open debt with a schedule, ask the
 * mirror what became of it, and write that down.
 *
 * A schedule that ran and moved nothing is a default, not a repayment, and it
 * keeps consuming the line. Getting that backwards would have made defaulting
 * the cheapest way to free up credit.
 */
export type Reconciliation = {
  checked: number;
  settled: RailDebt[];
  defaulted: RailDebt[];
  stillPending: number;
  unresolved: { scheduleId: string; reason: string }[];
};

export async function reconcileRailDebt(humanOwner?: string): Promise<Reconciliation> {
  const debts = reconcilableDebts(humanOwner);
  const out: Reconciliation = {
    checked: debts.length,
    settled: [],
    defaulted: [],
    stillPending: 0,
    unresolved: [],
  };

  for (const debt of debts) {
    const id = debt.scheduleId!;
    const outcome = await scheduleOutcome(id);

    if (outcome.state === "settled") {
      const row = settleRailDebtBySchedule(id);
      if (row) out.settled.push(row);
    } else if (outcome.state === "defaulted") {
      const row = markRailDebtDefaulted(id, outcome.reason);
      if (row) out.defaulted.push(row);
    } else if (outcome.state === "pending") {
      out.stillPending++;
    } else {
      // Leave it open. A mirror that cannot answer is not evidence of anything,
      // and writing a guess into the ledger is worse than waiting.
      out.unresolved.push({ scheduleId: id, reason: outcome.reason });
    }
  }

  return out;
}
