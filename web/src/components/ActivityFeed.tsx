"use client";

import React from "react";
import { ActivityItem } from "@/types";
import { ArrowDownLeft, ArrowUpRight, Plus, ExternalLink } from "lucide-react";

interface ActivityFeedProps {
  items: ActivityItem[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-xs font-mono text-zinc-600 border border-dashed border-white/[0.06] rounded-xl">
        No recent activity recorded
      </div>
    );
  }

  return (
    <div className="sleek-card rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
          Live Facility Audit Log
        </h3>
        <span className="text-[11px] font-mono text-zinc-500">
          {items.length} events logged
        </span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {items.map((item) => {
          const formattedTime = new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div
              key={item.id}
              className="px-4 py-3 flex items-center justify-between gap-3 text-xs font-mono hover:bg-zinc-900/40 transition"
            >
              {/* Type and Agent */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    item.type === "borrow"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : item.type === "repay"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : item.type === "remove"
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "bg-zinc-800 text-zinc-300 border border-white/[0.06]"
                  }`}
                >
                  {item.type === "borrow" && <ArrowDownLeft className="w-3.5 h-3.5" />}
                  {item.type === "repay" && <ArrowUpRight className="w-3.5 h-3.5" />}
                  {item.type === "register" && <Plus className="w-3.5 h-3.5" />}
                  {item.type === "remove" && <span className="text-xs">✕</span>}
                </div>

                <div>
                  <div className="text-zinc-200 font-medium">{item.agentName}</div>
                  <div className="text-[11px] text-zinc-500">{item.agentAddress.slice(0, 8)}...</div>
                </div>
              </div>

              {/* Event Type / Amount */}
              <div className="text-right">
                {item.amount !== undefined ? (
                  <div
                    className={`font-semibold tabular-nums ${
                      item.type === "borrow" ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {item.type === "borrow" ? "+" : "-"}${item.amount.toFixed(2)} USDC
                  </div>
                ) : (
                  <div className="text-zinc-300 font-medium">Facility Created</div>
                )}
                <div className="text-[10px] text-zinc-500">{formattedTime}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
