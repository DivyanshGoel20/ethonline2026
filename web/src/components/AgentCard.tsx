"use client";

import React from "react";
import { Agent } from "@/types";
import { Bot, CheckCircle2, AlertCircle, ExternalLink, Zap, RefreshCw } from "lucide-react";

interface AgentCardProps {
  agent: Agent;
  onSimulateBorrow: (agent: Agent) => void;
  onSimulateRepay: (agent: Agent) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onSimulateBorrow,
  onSimulateRepay,
}) => {
  const availableCredit = Math.max(0, agent.creditLimit - agent.outstandingDebt);
  const utilizationPct = Math.min(100, Math.round((agent.outstandingDebt / agent.creditLimit) * 100));

  return (
    <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between transition duration-200 hover:shadow-xl hover:shadow-teal-500/5">
      <div>
        {/* Header: Name + Address + Status */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-teal-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base leading-tight">{agent.name}</h3>
              <p className="text-xs font-mono text-slate-400 truncate max-w-[170px]" title={agent.address}>
                {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
              agent.status === "Healthy"
                ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
                : "bg-teal-950/60 border-teal-500/30 text-teal-300"
            }`}
          >
            {agent.status === "Healthy" ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            <span>{agent.status}</span>
          </div>
        </div>

        {/* Credit Utilization Bar */}
        <div className="space-y-1.5 mb-5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Credit Utilization</span>
            <span className="text-white font-medium">{utilizationPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                utilizationPct > 80 ? "bg-rose-400" : utilizationPct > 40 ? "bg-amber-400" : "bg-teal-400"
              }`}
              style={{ width: `${utilizationPct}%` }}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-white/5 mb-5 text-xs">
          <div>
            <div className="text-slate-400 text-[11px]">Available Credit</div>
            <div className="font-semibold text-white text-sm mt-0.5">
              ${availableCredit.toFixed(2)} <span className="text-[10px] text-teal-400">USDC</span>
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-[11px]">Outstanding Debt</div>
            <div className={`font-semibold text-sm mt-0.5 ${agent.outstandingDebt > 0 ? "text-amber-400" : "text-slate-300"}`}>
              ${agent.outstandingDebt.toFixed(2)} <span className="text-[10px]">USDC</span>
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-[11px]">Wallet Balance</div>
            <div className="font-semibold text-white text-sm mt-0.5">
              ${agent.currentBalance.toFixed(2)} <span className="text-[10px] text-slate-400">USDC</span>
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-[11px]">Lifetime Repaid</div>
            <div className="font-semibold text-emerald-400 text-sm mt-0.5">
              ${agent.totalRepaid.toFixed(2)} <span className="text-[10px]">USDC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <button
          onClick={() => onSimulateBorrow(agent)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-medium transition"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Draw Float</span>
        </button>

        <button
          onClick={() => onSimulateRepay(agent)}
          disabled={agent.outstandingDebt <= 0}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition ${
            agent.outstandingDebt > 0
              ? "bg-slate-800 hover:bg-slate-700 border-white/10 text-white"
              : "opacity-40 cursor-not-allowed bg-slate-900 border-white/5 text-slate-500"
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Repay</span>
        </button>
      </div>
    </div>
  );
};
