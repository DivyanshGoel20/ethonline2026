"use client";

import React from "react";
import { CreditStats as CreditStatsType } from "@/types";

interface CreditStatsProps {
  stats: CreditStatsType;
}

export const CreditStats: React.FC<CreditStatsProps> = ({ stats }) => {
  const facilityLimit = 500;
  const outstanding = stats.totalOutstandingDebt;
  const available = Math.max(0, facilityLimit - outstanding);
  const utilizationRatio = Math.min(
    100,
    Math.round((outstanding / facilityLimit) * 100)
  );

  return (
    <div className="fintech-card rounded-2xl p-6 sm:p-8 relative overflow-hidden">
      {/* Background radial accent glow - ultra restrained */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Main Hero Numbers */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-wrap items-baseline gap-8 sm:gap-12">
            {/* 1. Available Credit */}
            <div>
              <div className="text-xs font-medium text-zinc-400 tracking-wide">
                Available Credit
              </div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white tracking-tight tabular-nums mt-1 font-sans">
                ${available.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                Settled on Arc Testnet in USDC
              </div>
            </div>

            {/* 2. Outstanding Debt */}
            <div>
              <div className="text-xs font-medium text-zinc-400 tracking-wide">
                Outstanding
              </div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-zinc-300 tracking-tight tabular-nums mt-1 font-sans">
                ${outstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                Across all linked agents
              </div>
            </div>
          </div>

          {/* Subtle Utilization Bar */}
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Facility Utilization</span>
              <span className="font-mono text-zinc-400">{utilizationRatio}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(utilizationRatio, 1)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Secondary Metrics Column */}
        <div className="lg:col-span-4 lg:border-l lg:border-white/[0.06] lg:pl-8 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            <div>
              <div className="text-[11px] text-zinc-500 font-medium">Human Facility Limit</div>
              <div className="text-sm font-semibold text-zinc-200 mt-0.5 tabular-nums">
                ${facilityLimit.toFixed(2)} USDC
              </div>
            </div>

            <div>
              <div className="text-[11px] text-zinc-500 font-medium">Cumulative Repaid</div>
              <div className="text-sm font-semibold text-emerald-400 mt-0.5 tabular-nums">
                ${stats.totalRepaid.toFixed(2)} USDC
              </div>
            </div>

            <div>
              <div className="text-[11px] text-zinc-500 font-medium">Connected Agents</div>
              <div className="text-sm font-semibold text-zinc-300 mt-0.5 tabular-nums">
                {stats.activeAgentsCount} {stats.activeAgentsCount === 1 ? "agent" : "agents"}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-zinc-500 font-medium">Facility Standing</div>
              <div className="text-sm font-semibold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Good Standing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
