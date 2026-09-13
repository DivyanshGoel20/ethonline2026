import fs from "node:fs";
import path from "node:path";

/**
 * Which repayments are currently parked on the network.
 *
 * The schedule id came back in a receipt, was printed, and was then forgotten -
 * so nothing could cancel an obligation later, and a borrower who wanted to
 * settle early had no way to reach the cheque with their name on it. The
 * network is the source of truth for whether a schedule is live; this is the
 * index that lets Float find it.
 */
export interface ParkedRepayment {
  scheduleId: string;
  borrowerId: string;
  amountUsd: number;
  dueAt: string;
  resource: string;
  createdAt: number;
  status: "live" | "settled" | "cancelled";
  settledTransactionId?: string;
  settledAt?: number;
}

const FILE = path.resolve(process.cwd(), "hedera", "data", "schedules.json");

function readAll(): ParkedRepayment[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: ParkedRepayment[]): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

export function recordParked(entry: Omit<ParkedRepayment, "createdAt" | "status">): ParkedRepayment {
  const row: ParkedRepayment = { ...entry, createdAt: Date.now(), status: "live" };
  const all = readAll();
  all.push(row);
  writeAll(all);
  return row;
}

/**
 * Whether a row is still an obligation Float can act on.
 *
 * The stored status is not enough. Nothing marks a row settled when consensus
 * executes it on its date - that is the point of a parked repayment, and it is
 * also why this index goes stale on its own. A row still reading "live" an hour
 * after its date is not parked; the network already ran it and dropped the
 * entity, and only the Mirror Node knows whether it paid or defaulted.
 *
 * Treating those as live re-opened the double-charge this whole mechanism
 * exists to prevent: they were offered for early settlement, which would
 * transfer a second time and then fail to delete a schedule that was gone.
 */
export function isStillParked(row: ParkedRepayment): boolean {
  return row.status === "live" && new Date(row.dueAt).getTime() > Date.now();
}

export function liveRepayments(borrowerId?: string): ParkedRepayment[] {
  return readAll()
    .filter(isStillParked)
    .filter((r) => !borrowerId || r.borrowerId === borrowerId)
    // Oldest first: the obligation closest to falling due is the one to clear.
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function findParked(scheduleId: string): ParkedRepayment | undefined {
  return readAll().find((r) => r.scheduleId === scheduleId);
}

export function markSettled(
  scheduleId: string,
  status: "settled" | "cancelled",
  transactionId?: string
): void {
  const all = readAll();
  const row = all.find((r) => r.scheduleId === scheduleId);
  if (!row) return;
  row.status = status;
  row.settledAt = Date.now();
  if (transactionId) row.settledTransactionId = transactionId;
  writeAll(all);
}
