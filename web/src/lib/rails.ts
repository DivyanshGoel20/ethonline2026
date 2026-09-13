/**
 * Float's two settlement rails.
 *
 * Arc is the debt ledger: profiles, limits and drawdowns live there and nothing
 * moves that. Hedera is a second place value can move, with a property Arc does
 * not have - a repayment can be parked on consensus with a date on it, so
 * collection does not depend on anyone being online later.
 *
 * They are deliberately separate processes. The Hedera credentials live in the
 * repo-root .env alongside the rest of that rail, and the web app reaches it
 * over HTTP rather than importing the SDK and duplicating six keys.
 */
export type Rail = "arc" | "hedera";

export const HEDERA_PAYER_URL =
  process.env.HEDERA_PAYER_URL || "http://localhost:4023";

export const RAIL_LABELS: Record<Rail, string> = {
  arc: "Arc",
  hedera: "Hedera",
};
