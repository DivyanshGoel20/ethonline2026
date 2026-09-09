"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, Cpu, Sparkles } from "lucide-react";

interface HeaderProps {
  isWorldVerified: boolean;
  onOpenWorldVerify: () => void;
  onOpenAddAgent: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isWorldVerified,
  onOpenWorldVerify,
  onOpenAddAgent,
}) => {
  return (
    <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Sparkles className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight text-white">FLOAT</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                Arc USDC
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Credit Facility for AI Agents</p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Network Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-xs font-medium text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Arc Testnet
          </div>

          {/* World Verification Status */}
          {isWorldVerified ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/80 border border-teal-500/30 text-teal-300 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>World Selfie Verified</span>
            </div>
          ) : (
            <button
              onClick={onOpenWorldVerify}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition"
            >
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>Verify with World</span>
            </button>
          )}

          {/* Add Agent Button */}
          <button
            onClick={onOpenAddAgent}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-semibold shadow-md shadow-teal-500/10 transition active:scale-95"
          >
            <Cpu className="w-4 h-4" />
            <span>Manage Agents</span>
          </button>
        </div>
      </div>
    </header>
  );
};
