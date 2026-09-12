"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Award,
  Clock,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { ReputationSummary, CREDIT_TIERS } from "@/lib/reputationEngine";

interface ReputationTierCardProps {
  humanOwner: string;
  refreshTrigger?: number;
}

export const ReputationTierCard: React.FC<ReputationTierCardProps> = ({
  humanOwner,
  refreshTrigger,
}) => {
  const [data, setData] = useState<ReputationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFifoInfo, setShowFifoInfo] = useState(false);

  const fetchReputation = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/reputation?humanOwner=${encodeURIComponent(humanOwner)}`
      );
      const json = await res.json();
      if (json.success && json.summary) {
        setData(json.summary);
      }
    } catch (err) {
      console.warn("[ReputationTierCard] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (humanOwner) {
      fetchReputation();
    }
  }, [humanOwner, refreshTrigger]);

  if (isLoading && !data) {
    return (
      <div className="fintech-card rounded-2xl p-5 animate-pulse bg-white/[0.02] border border-white/[0.05]">
        <div className="h-4 bg-zinc-800 rounded w-1/4 mb-3" />
        <div className="h-8 bg-zinc-800 rounded w-1/2 mb-4" />
        <div className="h-2 bg-zinc-800 rounded w-full" />
      </div>
    );
  }

  if (!data) return null;

  const { currentTier, nextTier, reputationScore, tierProgress, oldestActiveLoan } = data;

  const formatTimeRemaining = (hours: number) => {
    if (hours <= 0) return "Overdue";
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) return `${days}d ${remHours}h`;
    return `${remHours}h`;
  };

  return (
    <div className="fintech-card rounded-2xl p-5 sm:p-6 border border-white/[0.08] relative overflow-hidden group">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Tier & Credit Score Banner */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
              Float Operator Reputation & Credit Tier
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {currentTier.name}
            </h2>
            <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold">
              ${currentTier.creditLimit}.00 USDC Shared Limit
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>
              Credit Score:{" "}
              <strong className="text-white font-mono">{reputationScore}/100</strong>
            </span>
            <span>•</span>
            <span>
              Repayments:{" "}
              <strong className="text-white font-mono">{data.repaymentsCount}</strong>
            </span>
            <span>•</span>
            <span>
              Interest Paid:{" "}
              <strong className="text-white font-mono">
                ${data.totalInterestPaid.toFixed(2)} USDC
              </strong>
            </span>
          </div>
        </div>

        {/* 7-Day Loan Status Badge */}
        <div className="lg:text-right p-3.5 rounded-xl bg-black/40 border border-white/[0.05] min-w-[240px]">
          <div className="text-[11px] font-mono text-zinc-500 uppercase flex items-center lg:justify-end gap-1 mb-1">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Maturity Window (7d Max)</span>
          </div>

          {oldestActiveLoan ? (
            <div className="space-y-1">
              <div className="flex items-center lg:justify-end gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold font-mono ${
                    oldestActiveLoan.isOverdue
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                      : oldestActiveLoan.isDueSoon
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {oldestActiveLoan.isOverdue
                    ? "OVERDUE (Restricted)"
                    : oldestActiveLoan.isDueSoon
                    ? "DUE SOON"
                    : "HEALTHY"}
                </span>
                <span className="text-sm font-semibold font-mono text-zinc-200">
                  {formatTimeRemaining(oldestActiveLoan.hoursRemaining)}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Oldest tranche:{" "}
                <span className="font-mono text-zinc-200">
                  ${oldestActiveLoan.totalDue.toFixed(2)} USDC
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center lg:justify-end gap-1.5 text-xs text-emerald-400 font-medium mt-1">
              <CheckCircle className="w-4 h-4" />
              <span>All Loans Settled (100% Headroom)</span>
            </div>
          )}
        </div>
      </div>

      {/* Next Tier Progression */}
      {nextTier && (
        <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Next Graduation:</span>
              <strong className="text-white font-medium">{nextTier.name}</strong>
              <span className="text-zinc-500 font-mono">(${nextTier.creditLimit}.00 limit)</span>
            </div>
            <span className="text-cyan-400 font-mono font-semibold">
              {tierProgress.overallProgressPct}% complete
            </span>
          </div>

          {/* Unified Progress Bar */}
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${tierProgress.overallProgressPct}%` }}
            />
          </div>

          {/* Detailed Criteria Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono pt-1">
            <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.04] flex items-center justify-between">
              <span className="text-zinc-500 text-[11px]">Interest Paid:</span>
              <span className="text-zinc-200">
                ${data.totalInterestPaid.toFixed(2)} / ${nextTier.requiredInterestPaid.toFixed(2)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.04] flex items-center justify-between">
              <span className="text-zinc-500 text-[11px]">Loan History:</span>
              <span className="text-zinc-200">
                {data.totalActiveDurationDays}d / {nextTier.requiredActiveDurationDays}d
              </span>
            </div>
            <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.04] flex items-center justify-between">
              <span className="text-zinc-500 text-[11px]">Settlements:</span>
              <span className="text-zinc-200">
                {data.repaymentsCount} / {nextTier.requiredRepaymentsCount}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* FIFO Tranche Maturity Explanation Trigger */}
      <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setShowFifoInfo(!showFifoInfo)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-cyan-300 transition text-[11px]"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>How does multiple loan timing work? (FIFO Tranche Model)</span>
        </button>
        <span className="text-[10px] font-mono text-zinc-500">
          Fee: 1.0% upfront + 0.05%/day
        </span>
      </div>

      {/* Expandable FIFO Details */}
      {showFifoInfo && (
        <div className="mt-3 p-3.5 rounded-xl bg-zinc-950/90 border border-white/[0.08] text-xs text-zinc-300 space-y-2 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tranche-Based FIFO (First-In, First-Out) Maturity</span>
          </div>
          <p>
            If you take a loan on Day 0 and another on Day 4, each loan tranche receives its own full 7-day maturity window.
            Your facility's earliest due date is governed by your oldest active loan.
          </p>
          <p className="text-zinc-400">
            When your agent makes a repayment, funds automatically settle the oldest loan first. Once the oldest loan is cleared, your facility countdown immediately rolls forward to the next tranche!
          </p>
        </div>
      )}
    </div>
  );
};
