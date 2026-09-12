"use client";

import React, { useState } from "react";
import { X, Bot, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";
import { Agent } from "@/types";

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentAdded: (agent: Agent) => void;
  humanOwner?: string | null;
}

export const AddAgentModal: React.FC<AddAgentModalProps> = ({
  isOpen,
  onClose,
  onAgentAdded,
  humanOwner,
}) => {
  const [name, setName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPreconfigured =
    walletAddress.trim().toLowerCase() === "0xa5509d881a4632591117bcb7145ec9e80c015dc3";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedAddress = walletAddress.trim();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter an agent name.");
      return;
    }

    if (!trimmedAddress) {
      setError("Please enter the Arc agent wallet address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          name: trimmedName,
          walletAddress: trimmedAddress,
          humanOwner: humanOwner || "anonymous_human",
          privateKey: privateKey.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "This address is not a valid/usable Arc Testnet agent wallet.");
      }

      onAgentAdded(data.agent);
      setName("");
      setWalletAddress("");
      setPrivateKey("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add agent.");
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
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-zinc-300">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Add Agent</h2>
              <p className="text-[11px] font-mono text-zinc-500">Connect an Arc Testnet agent to Float Credit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network Badge */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-white/[0.04] text-xs font-mono">
          <span className="text-zinc-400">Target Network</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 text-[11px]">
            <ShieldCheck className="w-3 h-3" />
            Arc Testnet (Chain ID 5042002)
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-400">Agent Name</label>
            <input
              type="text"
              placeholder="e.g. Autonomous Research Agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/[0.08] text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-400">Agent Wallet Address</label>
            <input
              type="text"
              placeholder="0xA5509d881A4632591117bCB7145EC9e80C015DC3"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/[0.08] text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-zinc-500">Active EVM address on Arc Testnet</span>
              {isPreconfigured ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  ⚡ Autonomous Signer Ready
                </span>
              ) : (
                <span className="text-zinc-400">AgentKit verified</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-zinc-400">
                Agent Private Key <span className="text-zinc-600">(Optional)</span>
              </label>
              {isPreconfigured && (
                <span className="text-[10px] font-mono text-emerald-400">
                  Pre-configured in Keystore
                </span>
              )}
            </div>
            <input
              type="password"
              placeholder={isPreconfigured ? "••••••••••••••••••••••••••••••••" : "0x... (Enables autonomous transaction signing)"}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/[0.08] text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <p className="text-[10px] font-mono text-zinc-500">
              Allows the agent to sign x402 nanopayments and Arc Testnet transactions autonomously.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/20 text-xs font-mono text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-mono transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold font-mono transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{loading ? "Verifying Address..." : "Verify & Add Agent"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
