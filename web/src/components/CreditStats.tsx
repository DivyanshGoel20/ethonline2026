"use client";

import React from "react";
import { CreditStats as CreditStatsType } from "@/types";

interface CreditStatsProps {
  stats: CreditStatsType;
}

export const CreditStats: React.FC<CreditStatsProps> = ({ stats }) => {
  const utilizationRatio =
    stats.totalAvailableCredit + stats.totalOutstandingDebt > 0
      ? Math.round(
          (stats.totalOutstandingDebt /
            (stats.totalAvailableCredit + stats.totalOutstandingDebt)) *
            100
        )
      : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total Available Credit */}
      <div className="sleek-card p-4 rounded-xl relative">
        <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
          <span>Available Headroom</span>
          <span className="text-emerald-400 text-[10px] font-mono">READY</span>
        </div>
        <div className="text-2xl font-bold text-zinc-100 tracking-tight tabular-nums">
          ${stats.totalAvailableCredit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-zinc-500 font-mono mt-1">
          Settled in USDC
        </div>
      </div>

      {/* 2. Total Credit Allocated / Debt */}
      <div className="sleek-card p-4 rounded-xl relative">
        <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
          <span>Outstanding Debt</span>
          <span className="text-zinc-500 text-[10px] font-mono">{utilizationRatio}% utilized</span>
        </div>
        <div className="text-2xl font-bold text-zinc-100 tracking-tight tabular-nums">
          ${stats.totalOutstandingDebt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {/* Micro utilization bar */}
        <div className="w-full h-1 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
          <div
            className="h-full bg-zinc-300 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, utilizationRatio)}%` }}
          />
        </div>
      </div>

      {/* 3. Lifetime Flow (Borrowed vs Repaid) */}
      <div className="sleek-card p-4 rounded-xl relative">
        <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
          Cumulative Volume
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-zinc-500 font-mono">Borrowed</div>
            <div className="text-base font-semibold text-zinc-200 tabular-nums">
              ${stats.totalBorrowed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="h-6 w-px bg-zinc-800" />
          <div className="text-right">
            <div className="text-xs text-zinc-500 font-mono">Repaid</div>
            <div className="text-base font-semibold text-emerald-400 tabular-nums">
              ${stats.totalRepaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-zinc-500 font-mono mt-1">
          All-time credit operations
        </div>
      </div>

      {/* 4. Active Agents Standing */}
      <div className="sleek-card p-4 rounded-xl relative">
        <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
          <span>Connected Agents</span>
          <span className="text-emerald-400 text-[10px] font-mono">● 100% HEALTHY</span>
        </div>
        <div className="text-2xl font-bold text-zinc-100 tracking-tight tabular-nums">
          {stats.activeAgentsCount} <span className="text-xs font-normal text-zinc-500 font-mono">facilities</span>
        </div>
        <div className="text-[11px] text-zinc-500 font-mono mt-1">
          Zero defaults recorded
        </div>
      </div>
    </div>
  );
};
