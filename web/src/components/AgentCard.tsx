"use client";

import React, { useState } from "react";
import { Agent } from "@/types";
import { Copy, Check, ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface AgentCardProps {
  agent: Agent;
  onOpenBorrow: (agent: Agent) => void;
  onOpenRepay: (agent: Agent) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onOpenBorrow,
  onOpenRepay,
}) => {
  const [copied, setCopied] = useState(false);

  const availableCredit = Math.max(0, agent.creditLimit - agent.outstandingDebt);
  const utilizationRatio = Math.min(
    100,
    Math.round((agent.outstandingDebt / agent.creditLimit) * 100)
  );

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(agent.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="sleek-card p-5 rounded-xl flex flex-col justify-between group">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-zinc-100 text-sm tracking-tight">{agent.name}</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-white/[0.05]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {agent.status}
              </span>
            </div>

            {/* Address */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 mt-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition"
              title="Click to copy full address"
            >
              <span>
                {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
              </span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-mono uppercase text-zinc-500">Credit Limit</div>
            <div className="text-xs font-mono font-medium text-zinc-300 tabular-nums">
              ${agent.creditLimit.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Utilization Bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-zinc-400">Available: ${availableCredit.toFixed(2)}</span>
            <span className="text-zinc-500">{utilizationRatio}% used</span>
          </div>
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                utilizationRatio > 75 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${utilizationRatio}%` }}
            />
          </div>
        </div>

        {/* Financial Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-zinc-900/60 border border-white/[0.04] mb-4 text-xs font-mono">
          <div>
            <div className="text-zinc-500 text-[10px] uppercase">Debt</div>
            <div className={`font-medium tabular-nums mt-0.5 ${agent.outstandingDebt > 0 ? "text-zinc-200" : "text-zinc-400"}`}>
              ${agent.outstandingDebt.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-zinc-500 text-[10px] uppercase">Liquid</div>
            <div className="font-medium text-zinc-200 tabular-nums mt-0.5">
              ${agent.currentBalance.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-zinc-500 text-[10px] uppercase">Repaid</div>
            <div className="font-medium text-emerald-400 tabular-nums mt-0.5">
              ${agent.totalRepaid.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Card Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/[0.05]">
        <button
          onClick={() => onOpenBorrow(agent)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/[0.06] transition active:scale-[0.98]"
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-zinc-400" />
          <span>Draw</span>
        </button>

        <button
          onClick={() => onOpenRepay(agent)}
          disabled={agent.outstandingDebt <= 0}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
            agent.outstandingDebt > 0
              ? "bg-zinc-100 hover:bg-white text-zinc-950 border-transparent active:scale-[0.98]"
              : "opacity-30 cursor-not-allowed bg-transparent text-zinc-600 border-white/[0.04]"
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Repay</span>
        </button>
      </div>
    </div>
  );
};
