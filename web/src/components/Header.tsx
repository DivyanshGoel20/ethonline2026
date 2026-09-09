"use client";

import React from "react";
import { Plus, Terminal, ShieldCheck, LogOut } from "lucide-react";

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
  activeAgentsCount,
}) => {
  return (
    <header className="border-b border-white/[0.08] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center font-mono font-black text-xs text-zinc-950 shadow-sm">
              FL
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-sm tracking-wide text-zinc-100">FLOAT</span>
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
                // CREDIT PROTOCOL
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-zinc-800 hidden md:block" />

          {/* Network indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Arc Testnet (5042002)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* World Verified Status & Sign Out */}
          {isWorldVerified && (
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-emerald-500/30 text-emerald-400 text-xs font-mono"
                title={`World ID Cryptographic Nullifier: ${nullifierHash || "Active"}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Human Verified</span>
                {nullifierHash && (
                  <span className="text-zinc-500 text-[10px]">
                    ({nullifierHash.slice(0, 6)}...{nullifierHash.slice(-4)})
                  </span>
                )}
              </div>

              <button
                onClick={onSignOut}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-mono transition"
                title="Sign out of World ID session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}

          {/* Agent API Docs Button */}
          <button
            onClick={onOpenApiDocs}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition"
          >
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">API</span>
          </button>

          {/* Add Agent Button */}
          <button
            onClick={onOpenAddAgent}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-semibold shadow-sm transition active:scale-[0.98]"
            title="Add an Arc Testnet agent wallet"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-950" />
            <span>Add Agent</span>
          </button>
        </div>
      </div>
    </header>
  );
};
