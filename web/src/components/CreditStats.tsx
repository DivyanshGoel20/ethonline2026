"use client";

import React from "react";
import { CreditStats as CreditStatsType } from "@/types";
import { Wallet, ArrowDownRight, ArrowUpRight, ShieldCheck, Activity, Users } from "lucide-react";

interface CreditStatsProps {
  stats: CreditStatsType;
}

export const CreditStats: React.FC<CreditStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Available Credit */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Available Credit</span>
          <Wallet className="w-4 h-4 text-teal-400" />
        </div>
        <div className="text-xl font-bold text-white tracking-tight">
          ${stats.totalAvailableCredit.toLocaleString()} <span className="text-xs text-teal-400 font-normal">USDC</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Ready for draw</div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-400 opacity-60" />
      </div>

      {/* Credit Used */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Credit Used</span>
          <Activity className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-xl font-bold text-white tracking-tight">
          ${stats.totalCreditUsed.toLocaleString()} <span className="text-xs text-amber-400 font-normal">USDC</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Across all facilities</div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 opacity-60" />
      </div>

      {/* Outstanding Debt */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Outstanding</span>
          <ArrowDownRight className="w-4 h-4 text-rose-400" />
        </div>
        <div className="text-xl font-bold text-white tracking-tight">
          ${stats.totalOutstandingDebt.toLocaleString()} <span className="text-xs text-rose-400 font-normal">USDC</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Due on settlement</div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 opacity-60" />
      </div>

      {/* Total Borrowed */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Total Borrowed</span>
          <ArrowUpRight className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-xl font-bold text-white tracking-tight">
          ${stats.totalBorrowed.toLocaleString()} <span className="text-xs text-indigo-400 font-normal">USDC</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Lifetime draws</div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 opacity-60" />
      </div>

      {/* Total Repaid */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Total Repaid</span>
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-xl font-bold text-white tracking-tight">
          ${stats.totalRepaid.toLocaleString()} <span className="text-xs text-emerald-400 font-normal">USDC</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Settled on Arc</div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 opacity-60" />
      </div>

      {/* Active Agents */}
      <div className="glass-panel p-4 rounded-xl relative overflow-hidden group">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Active Agents</span>
          <Users className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-xl font-bold text-white tracking-tight">
          {stats.activeAgentsCount} <span className="text-xs text-cyan-400 font-normal">Bots</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Authorized on Float</div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 opacity-60" />
      </div>
    </div>
  );
};
