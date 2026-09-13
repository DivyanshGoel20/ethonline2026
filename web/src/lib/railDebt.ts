import fs from "fs";
import path from "path";
import { writeJsonAtomic } from "./atomicWrite";

/**
 * Debt drawn on a rail other than Arc.
 *
 * Arc's facility is meant to be the single answer to "what does this human
 * owe", but headroom was computed purely from Arc agents - so a Hedera
 * drawdown was invisible to it. An agent could exhaust its credit line on Arc
 * and immediately borrow the same money again on Hedera, because neither side
 * could see the other's debt.
 *
 * This is the missing column. It is not a second ledger: entries here are
 * counted against the same limit, and they close when the rail that issued
 * them collects.
 */
export interface RailDebt {
  id: string;
  humanOwner: string;
  rail: "hedera";
  amountUsd: number;
  /** The parked repayment collecting this debt, if the rail has one. */
  scheduleId?: string;
  resource: string;
  createdAt: number;
  /**
   * open      - parked, not yet due
   * settled   - collected, headroom returned
   * defaulted - the schedule ran and moved nothing; still owed, still consuming
   *             the line. A default must never be cheaper than repaying.
   */
  status: "open" | "settled" | "defaulted";
  defaultedAt?: number;
  defaultReason?: string;
  settledAt?: number;
}

function filePath(): string {
  const candidates = [
    path.resolve(process.cwd(), "web", "data", "rail-debt.json"),
    path.resolve(process.cwd(), "data", "rail-debt.json"),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return path.resolve(process.cwd(), "data", "rail-debt.json");
}

function readAll(): RailDebt[] {
  try {
    const p = filePath();
    if (!fs.existsSync(p)) return [];
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const writeAll = (rows: RailDebt[]) => writeJsonAtomic(filePath(), rows);

export function openRailDebt(entry: Omit<RailDebt, "id" | "createdAt" | "status">): RailDebt {
  const row: RailDebt = {
    ...entry,
    id: `rd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    status: "open",
  };
  const all = readAll();
  all.push(row);
  writeAll(all);
  return row;
}

/** What this human owes on other rails, counted against the same limit. */
export function railDebtTotal(humanOwner: string): number {
  if (!humanOwner) return 0;
  // Defaulted debt still counts. It was never repaid, so freeing the headroom
  // would make failing to pay the cheapest way to borrow again.
  const total = readAll()
    .filter(
      (r) =>
        (r.status === "open" || r.status === "defaulted") &&
        r.humanOwner.toLowerCase() === humanOwner.toLowerCase()
    )
    .reduce((n, r) => n + r.amountUsd, 0);
  return Math.round(total * 10000) / 10000;
}

export function openRailDebts(humanOwner: string): RailDebt[] {
  return readAll().filter(
    (r) => r.status === "open" && r.humanOwner.toLowerCase() === humanOwner.toLowerCase()
  );
}

/** The issuing rail collected, so the headroom comes back. */
export function settleRailDebtBySchedule(scheduleId: string): RailDebt | null {
  const all = readAll();
  const row = all.find((r) => r.scheduleId === scheduleId && r.status === "open");
  if (!row) return null;
  row.status = "settled";
  row.settledAt = Date.now();
  writeAll(all);
  return row;
}

/** The schedule ran and collected nothing. The debt stands. */
export function markRailDebtDefaulted(scheduleId: string, reason: string): RailDebt | null {
  const all = readAll();
  const row = all.find((r) => r.scheduleId === scheduleId && r.status === "open");
  if (!row) return null;
  row.status = "defaulted";
  row.defaultedAt = Date.now();
  row.defaultReason = reason;
  writeAll(all);
  return row;
}

/** Every open debt with a parked repayment, for reconciliation. */
export function reconcilableDebts(humanOwner?: string): RailDebt[] {
  return readAll().filter(
    (r) =>
      r.status === "open" &&
      !!r.scheduleId &&
      (!humanOwner || r.humanOwner.toLowerCase() === humanOwner.toLowerCase())
  );
}
