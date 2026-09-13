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

/**
 * What actually differs between the rails, in the fewest words that are still
 * true.
 *
 * The switch used to be two buttons reading "Arc" and "Hedera", which tells
 * someone watching nothing at all - not that these are separate networks, not
 * that each has its own x402 service, not that the money moves by different
 * means. The words matter more than the toggle.
 */
export const RAIL_FACTS: Record<
  Rail,
  { network: string; facilitator: string; mechanism: string; resource: string }
> = {
  arc: {
    network: "Arc testnet",
    facilitator: "Circle Gateway",
    mechanism: "batched settlement",
    resource: "Float Premium API",
  },
  hedera: {
    network: "Hedera testnet",
    facilitator: "Blocky402",
    mechanism: "repayment parked on consensus",
    resource: "Float Risk Feed",
  },
};
