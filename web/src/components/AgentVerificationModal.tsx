"use client";

import React from "react";
import { X, ShieldCheck, Globe, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { Agent } from "@/types";

interface AgentVerificationModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenRegister?: (agent: Agent) => void;
}

export const AgentVerificationModal: React.FC<AgentVerificationModalProps> = ({
  agent,
  isOpen,
  onClose,
  onOpenRegister,
}) => {
  if (!isOpen || !agent) return null;

  const isVerified = agent.isWorldBacked || agent.agentBookStatus === "VERIFIED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0c0d12] border border-white/[0.08] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center">
              <Globe className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Identity Verification</h3>
              <p className="text-xs text-zinc-500">AgentBook canonical lookup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Verification Card */}
        <div className="space-y-3">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl flex items-center gap-3 border ${
              isVerified
                ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-300"
                : "bg-zinc-900/50 border-white/[0.06] text-zinc-400"
            }`}
          >
            {isVerified ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-zinc-500 shrink-0" />
            )}
            <div>
              <div className="text-xs font-semibold text-white">
                {isVerified ? "Human-backed ✓" : "Unverified in AgentBook"}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {isVerified
                  ? "Wallet has an active cryptographic registration bound to a verified World ID."
                  : "Not registered on World Chain. Credit facilities require human backing."}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="divide-y divide-white/[0.04] rounded-xl bg-[#12131a] border border-white/[0.05] text-xs font-mono">
            <div className="p-3 flex items-center justify-between">
              <span className="text-zinc-500">Agent Name</span>
              <span className="text-zinc-200 font-sans font-medium">{agent.name}</span>
            </div>

            <div className="p-3 flex flex-col gap-1">
              <span className="text-zinc-500">Agent Wallet (Arc Testnet)</span>
              <span className="text-zinc-200 break-all text-[11px]">{agent.address}</span>
            </div>

            <div className="p-3 flex items-center justify-between">
              <span className="text-zinc-500">AgentBook Contract</span>
              <a
                href="https://worldscan.org/address/0xA23aB2712eA7BBa896930544C7d6636a96b944dA"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 text-[11px]"
              >
                <span>0xA23a...44dA</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="p-3 flex items-center justify-between">
              <span className="text-zinc-500">Registry Network</span>
              <span className="text-zinc-300">World Chain (eip155:480)</span>
            </div>

            {agent.agentBookTxHash && (
              <div className="p-3 flex items-center justify-between">
                <span className="text-zinc-500">Registration Tx</span>
                <a
                  href={`https://worldscan.org/tx/${agent.agentBookTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 text-[11px]"
                >
                  <span className="truncate max-w-[120px]">{agent.agentBookTxHash}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-white/[0.05]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white transition"
          >
            Close
          </button>

          {!isVerified && onOpenRegister && (
            <button
              onClick={() => {
                onClose();
                onOpenRegister(agent);
              }}
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
            >
              Register with World
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
