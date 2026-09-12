"use client";

import React, { useState, useEffect } from "react";
import { ReputationSummary } from "@/lib/reputationEngine";
import { Label, usd } from "./ui";

interface ReputationTierCardProps {
  humanOwner: string;
  refreshTrigger?: number;
  /** Lets the facility hero show the tier's real limit. */
  onTier?: (limit: number) => void;
}

const timeLeft = (hours: number) => {
  if (hours <= 0) return "overdue";
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};

/**
 * Standing — one strip, not a dashboard.
 *
 * The limit is earned by settling on time, so the only things worth showing
 * are which tier you're on, how far to the next one, and when the oldest
 * tranche falls due.
 */
export const ReputationTierCard: React.FC<ReputationTierCardProps> = ({
  humanOwner,
  refreshTrigger,
  onTier,
}) => {
  const [data, setData] = useState<ReputationSummary | null>(null);

  useEffect(() => {
    if (!humanOwner) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/reputation?humanOwner=${encodeURIComponent(humanOwner)}`);
        const json = await res.json();
        if (!cancelled && json.success && json.summary) {
          setData(json.summary);
          onTier?.(json.summary.currentTier.creditLimit);
        }
      } catch {
        /* leave the strip out rather than showing a broken one */
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [humanOwner, refreshTrigger]);

  if (!data) return null;

  const { currentTier, nextTier, reputationScore, tierProgress, oldestActiveLoan } = data;
  const tierName = currentTier.name.replace(/^Tier \d+:\s*/, "");

  return (
    <section className="panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 px-5 py-4">
        <div className="flex items-baseline gap-4">
          <span className="serif" style={{ fontSize: 26 }}>
            {tierName}
          </span>
          <span className="mn faint" style={{ fontSize: 10 }}>
            {usd(currentTier.creditLimit)} limit &middot; score {reputationScore}/100
          </span>
        </div>

        {oldestActiveLoan ? (
          <span
            className="mn"
            style={{
              fontSize: 10,
              color: oldestActiveLoan.isOverdue
                ? "var(--red)"
                : oldestActiveLoan.isDueSoon
                ? "var(--flare)"
                : "var(--ink2)",
            }}
          >
            oldest tranche {usd(oldestActiveLoan.totalDue)} due in{" "}
            {timeLeft(oldestActiveLoan.hoursRemaining)}
          </span>
        ) : (
          <span className="mn faint" style={{ fontSize: 10 }}>
            nothing outstanding
          </span>
        )}
      </div>

      {nextTier && (
        <div className="px-5 py-4" style={{ borderTop: "1px solid var(--hair)" }}>
          <div className="flex items-baseline justify-between gap-4 mb-2.5">
            <Label>
              Next &middot; {nextTier.name.replace(/^Tier \d+:\s*/, "")} at {usd(nextTier.creditLimit)}
            </Label>
            <span className="mn" style={{ fontSize: 10, color: "var(--sea)" }}>
              {tierProgress.overallProgressPct}%
            </span>
          </div>

          <div style={{ height: 3, background: "var(--band)" }}>
            <div
              className="h-full transition-[width] duration-700"
              style={{ width: `${tierProgress.overallProgressPct}%`, background: "var(--sea)" }}
            />
          </div>

          <div className="flex flex-wrap gap-x-7 gap-y-1 mt-3 mn faint" style={{ fontSize: 9.5 }}>
            <span>
              interest {usd(data.totalInterestPaid)} / {usd(nextTier.requiredInterestPaid)}
            </span>
            <span>
              history {data.totalActiveDurationDays}d / {nextTier.requiredActiveDurationDays}d
            </span>
            <span>
              settled {data.repaymentsCount} / {nextTier.requiredRepaymentsCount}
            </span>
            <span>each draw gets its own 7-day window; repayments clear the oldest first</span>
          </div>
        </div>
      )}
    </section>
  );
};
