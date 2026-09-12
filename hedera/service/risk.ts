/**
 * What the feed actually sells.
 *
 * These scores are derived from repayment behaviour: an agent that has drawn on
 * a credit line and settled on time scores well, one that has let a scheduled
 * repayment lapse does not. In production the inputs are Float's own facility
 * ledger plus the HCS trail, both of which are already recorded per drawdown.
 *
 * The sample below is fixed rather than random, so a demo run is reproducible
 * and two buyers asking for the same record get the same answer - which is the
 * minimum a feed anyone pays for has to offer.
 */
export type RiskRecord = {
  agentId: string;
  score: number;
  band: "prime" | "standard" | "watch" | "delinquent";
  signals: { drawdowns: number; onTimeRepayments: number; missedSchedules: number; oldestLineDays: number };
  observedAt: string;
};

const band = (score: number): RiskRecord["band"] =>
  score >= 780 ? "prime" : score >= 660 ? "standard" : score >= 540 ? "watch" : "delinquent";

const SAMPLE: Omit<RiskRecord, "band" | "observedAt">[] = [
  { agentId: "0.0.7301991", score: 812, signals: { drawdowns: 41, onTimeRepayments: 41, missedSchedules: 0, oldestLineDays: 213 } },
  { agentId: "0.0.7302044", score: 774, signals: { drawdowns: 28, onTimeRepayments: 27, missedSchedules: 1, oldestLineDays: 168 } },
  { agentId: "0.0.7302118", score: 693, signals: { drawdowns: 19, onTimeRepayments: 18, missedSchedules: 1, oldestLineDays: 96 } },
  { agentId: "0.0.7302203", score: 671, signals: { drawdowns: 12, onTimeRepayments: 11, missedSchedules: 1, oldestLineDays: 74 } },
  { agentId: "0.0.7302287", score: 648, signals: { drawdowns: 9, onTimeRepayments: 8, missedSchedules: 1, oldestLineDays: 61 } },
  { agentId: "0.0.7302355", score: 602, signals: { drawdowns: 23, onTimeRepayments: 19, missedSchedules: 4, oldestLineDays: 140 } },
  { agentId: "0.0.7302411", score: 577, signals: { drawdowns: 7, onTimeRepayments: 5, missedSchedules: 2, oldestLineDays: 38 } },
  { agentId: "0.0.7302498", score: 544, signals: { drawdowns: 15, onTimeRepayments: 11, missedSchedules: 4, oldestLineDays: 88 } },
  { agentId: "0.0.7302560", score: 511, signals: { drawdowns: 6, onTimeRepayments: 3, missedSchedules: 3, oldestLineDays: 29 } },
  { agentId: "0.0.7302634", score: 483, signals: { drawdowns: 11, onTimeRepayments: 6, missedSchedules: 5, oldestLineDays: 57 } },
];

export const universe = (): readonly RiskRecord[] =>
  SAMPLE.map((r) => ({ ...r, band: band(r.score), observedAt: "2026-09-12T00:00:00.000Z" }));

/** The first `n` records, worst-to-best held stable so paging is coherent. */
export function riskFor(n: number): RiskRecord[] {
  const all = universe();
  const out: RiskRecord[] = [];
  for (let i = 0; i < n; i++) out.push(all[i % all.length]);
  return out;
}
