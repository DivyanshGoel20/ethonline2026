"use client";

import React from "react";
import { ActivityItem } from "@/types";
import { ArrowDownLeft, ArrowUpRight, Plus, ExternalLink, Bot } from "lucide-react";

interface ActivityFeedProps {
  items: ActivityItem[];
}

function getRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ items }) => {
  return (
    <div className="fintech-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between pb-1 border-b border-white/[0.05]">
        <h4 className="text-xs font-semibold text-zinc-300 font-sans">Recent Activity</h4>
        <span className="text-[11px] text-zinc-500 font-mono">Arc Testnet</span>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500 font-sans">
          No operations recorded yet
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 7).map((item) => {
            const isBorrow = item.type === "borrow";
            const isRepay = item.type === "repay";
            const isRegister = item.type === "register";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-xs py-1"
              >
                {/* Left: Icon & Event Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      isBorrow
                        ? "bg-zinc-900 border-white/[0.08] text-white"
                        : isRepay
                        ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400"
                        : "bg-zinc-900 border-white/[0.08] text-zinc-400"
                    }`}
                  >
                    {isBorrow && <ArrowDownLeft className="w-3.5 h-3.5" />}
                    {isRepay && <ArrowUpRight className="w-3.5 h-3.5" />}
                    {isRegister && <Bot className="w-3.5 h-3.5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="font-medium text-zinc-200 truncate">
                      {isBorrow
                        ? "Borrowed"
                        : isRepay
                        ? "Repaid"
                        : isRegister
                        ? "Agent registered"
                        : "Disconnected"}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate font-mono">
                      {item.agentName}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Relative Time */}
                <div className="text-right shrink-0">
                  {item.amount !== undefined ? (
                    <div
                      className={`font-semibold tabular-nums text-xs ${
                        isBorrow ? "text-white" : "text-emerald-400"
                      }`}
                    >
                      {isBorrow ? "+" : "-"}${item.amount.toFixed(2)} USDC
                    </div>
                  ) : (
                    <div className="text-zinc-400 text-[11px]">Ready</div>
                  )}
                  <div className="text-[10px] text-zinc-500">
                    {getRelativeTime(item.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
