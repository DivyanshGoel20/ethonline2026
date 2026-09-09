"use client";

import React, { useState } from "react";
import { Agent } from "@/types";
import { Copy, Check, ArrowDownLeft, ArrowUpRight, CheckCircle2, Globe, Trash2 } from "lucide-react";

interface AgentCardProps {
  agent: Agent;
  onOpenBorrow: (agent: Agent) => void;
  onOpenRepay: (agent: Agent) => void;
  onRemoveAgent?: (agent: Agent) => void;
  onOpenAgentKitRegister?: (agent: Agent) => void;
  onOpenDetails?: (agent: Agent) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onOpenBorrow,
  onOpenRepay,
  onRemoveAgent,
  onOpenAgentKitRegister,
  onOpenDetails,
}) => {
  const [copied, setCopied] = useState(false);

  const availableCredit = Math.max(0, agent.creditLimit - agent.outstandingDebt);
  const isWorldBacked = agent.isWorldBacked || agent.agentBookStatus === "VERIFIED";

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(agent.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const utilization = Math.min(
    100,
    Math.round((agent.outstandingDebt / agent.creditLimit) * 100)
  );

  return (
    <div className="fintech-card rounded-2xl p-5 sm:p-6 flex flex-col justify-between group transition duration-200">
      <div className="space-y-4">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight font-sans">
              {agent.name}
            </h3>

            {/* Truncated Address */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition mt-0.5"
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

          {/* World-Backed Status / Register Action */}
          <div>
            {isWorldBacked ? (
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Human-backed ✓</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Registered on AgentBook
                </div>
              </div>
            ) : (
              <button
                onClick={() => onOpenAgentKitRegister?.(agent)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-white/[0.08] transition active:scale-[0.98]"
              >
                Register with World
              </button>
            )}
          </div>
        </div>

        {/* Primary Financial Metric Readout */}
        <div className="pt-2">
          <div className="flex items-baseline justify-between text-sm sm:text-base font-medium">
            <span className="text-white tabular-nums">
              ${agent.outstandingDebt.toFixed(2)}{" "}
              <span className="text-xs font-normal text-zinc-400">borrowed</span>
            </span>
            <span className="text-zinc-400 tabular-nums">
              ${availableCredit.toFixed(2)}{" "}
              <span className="text-xs font-normal text-zinc-500">available</span>
            </span>
          </div>

          {/* Minimal utilization track */}
          <div className="w-full h-1 bg-white/[0.06] rounded-full mt-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                utilization > 80 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${Math.max(utilization, agent.outstandingDebt > 0 ? 3 : 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="flex items-center gap-2 pt-4 mt-4 border-t border-white/[0.05]">
        {/* Draw Button */}
        <button
          onClick={() => onOpenBorrow(agent)}
          className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-medium border border-white/[0.06] transition flex items-center justify-center gap-1.5"
        >
          <ArrowDownLeft className="w-3 h-3 text-zinc-400" />
          <span>Draw</span>
        </button>

        {/* Repay Button */}
        <button
          onClick={() => onOpenRepay(agent)}
          disabled={agent.outstandingDebt <= 0}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition flex items-center justify-center gap-1.5 ${
            agent.outstandingDebt > 0
              ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border-white/[0.06]"
              : "opacity-30 cursor-not-allowed bg-transparent text-zinc-600 border-white/[0.04]"
          }`}
        >
          <ArrowUpRight className="w-3 h-3 text-zinc-400" />
          <span>Repay</span>
        </button>

        {/* View Verification / Details */}
        <button
          onClick={() => (onOpenDetails ? onOpenDetails(agent) : onOpenAgentKitRegister?.(agent))}
          className="py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium border border-white/[0.06] transition"
          title="View Agent & Verification Details"
        >
          <span>View</span>
        </button>

        {/* Remove */}
        {onRemoveAgent && (
          <button
            onClick={() => onRemoveAgent(agent)}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-950/20 transition"
            title="Disconnect Agent"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
