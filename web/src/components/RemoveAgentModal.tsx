"use client";

import React, { useState } from "react";
import { X, AlertTriangle, Trash2, ShieldAlert } from "lucide-react";
import { Agent } from "@/types";

interface RemoveAgentModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmRemove: (agentAddress: string) => Promise<void>;
}

export const RemoveAgentModal: React.FC<RemoveAgentModalProps> = ({
  agent,
  isOpen,
  onClose,
  onConfirmRemove,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !agent) return null;

  const hasDebt = agent.outstandingDebt > 0;

  const handleConfirm = async () => {
    if (hasDebt) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirmRemove(agent.address);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to remove agent.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111115] border border-white/[0.1] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-950/40 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Disconnect Agent</h2>
              <p className="text-[11px] font-mono text-zinc-500">Remove from Float credit facility</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Body */}
        {hasDebt ? (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs font-mono text-amber-300 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-200">Active Debt Outstanding</span>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  <span className="text-white font-medium">{agent.name}</span> currently has an active draw of{" "}
                  <span className="text-amber-300 font-semibold">${agent.outstandingDebt.toFixed(2)} USDC</span>. You must repay all outstanding debt before disconnecting this agent.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition"
              >
                Understood
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-zinc-300 leading-relaxed font-mono">
              Are you sure you want to remove{" "}
              <span className="text-white font-semibold">{agent.name}</span> (
              <span className="text-zinc-400">{agent.address.slice(0, 6)}...{agent.address.slice(-4)}</span>)?
            </p>

            <div className="p-3 rounded-xl bg-zinc-950 border border-white/[0.04] text-[11px] font-mono text-zinc-400">
              This agent wallet will lose authorization to draw USDC from your World Selfie Check credit facility on Arc Testnet.
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/20 text-xs font-mono text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-mono transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold font-mono transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>{loading ? "Disconnecting..." : "Disconnect Agent"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
