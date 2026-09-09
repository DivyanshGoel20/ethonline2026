"use client";

import React from "react";
import { Plus, Terminal, LogOut, CheckCircle2 } from "lucide-react";

interface HeaderProps {
  onOpenAddAgent: () => void;
  onOpenApiDocs: () => void;
  onSignOut: () => void;
  isWorldVerified: boolean;
  nullifierHash: string | null;
  activeAgentsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddAgent,
  onOpenApiDocs,
  onSignOut,
  isWorldVerified,
  nullifierHash,
}) => {
  return (
    <header className="border-b border-white/[0.06] bg-[#060709]/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand & Network Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-white font-sans">
              FLOAT
            </span>
          </div>

          <div className="h-3.5 w-px bg-white/[0.08]" />

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
            </span>
            <span className="text-[11px] text-zinc-400">Arc Testnet</span>
            <span className="text-zinc-600 text-[10px]">•</span>
            <span className="text-[11px] text-zinc-400">World Chain</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Operator Status */}
          {isWorldVerified && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-white/[0.08] text-xs text-zinc-300"
              title="Verified Human Operator Session (World Selfie Check)"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-[11px] font-medium text-zinc-300">Human Verified</span>
            </div>
          )}

          {/* API Modal Trigger */}
          <button
            onClick={onOpenApiDocs}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/[0.08] bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition"
            title="Agent HTTP APIs"
          >
            <Terminal className="w-3 h-3" />
            <span className="hidden sm:inline text-[11px]">APIs</span>
          </button>

          {/* Add Agent Action */}
          <button
            onClick={onOpenAddAgent}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-sm transition active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-950" />
            <span>Add Agent</span>
          </button>

          {/* Sign Out */}
          {isWorldVerified && (
            <button
              onClick={onSignOut}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition"
              title="Sign out of World ID session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
