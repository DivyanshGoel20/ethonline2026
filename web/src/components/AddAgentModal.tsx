"use client";

import React, { useState } from "react";
import { X, Plus, KeyRound } from "lucide-react";
import { Agent } from "@/types";

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentAdded: (newAgent: Agent) => void;
}

export const AddAgentModal: React.FC<AddAgentModalProps> = ({
  isOpen,
  onClose,
  onAgentAdded,
}) => {
  const [tab, setTab] = useState<"existing" | "create">("create");
  const [agentAddress, setAgentAddress] = useState("");
  const [agentName, setAgentName] = useState("");
  const [creditLimit, setCreditLimit] = useState("500");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: tab === "existing" ? "add" : "create",
          agentAddress: tab === "existing" ? agentAddress : undefined,
          name: agentName || (tab === "existing" ? "External Agent" : "Autonomous Bot"),
          creditLimit: parseFloat(creditLimit) || 500,
        }),
      });

      const data = await res.json();
      if (data.agent) {
        onAgentAdded(data.agent);
        onClose();
      }
    } catch (err) {
      console.error("Failed to add agent:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111115] border border-white/[0.08] rounded-xl max-w-md w-full p-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-300">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">Add Agent Facility</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 rounded-lg bg-zinc-950 border border-white/[0.06] mt-4 text-xs font-mono">
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`py-1.5 rounded-md transition ${
              tab === "create" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Provision New
          </button>
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={`py-1.5 rounded-md transition ${
              tab === "existing" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Existing Wallet
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-400 uppercase mb-1.5">
              Agent Display Identifier
            </label>
            <input
              type="text"
              placeholder="e.g. Market Execution Agent"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-white/[0.08] text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 transition"
            />
          </div>

          {tab === "existing" && (
            <div>
              <label className="block text-xs font-mono text-zinc-400 uppercase mb-1.5">
                Agent Address (0x...)
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={agentAddress}
                onChange={(e) => setAgentAddress(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-white/[0.08] text-zinc-100 font-mono text-xs focus:outline-none focus:border-zinc-500 transition"
              />
              <p className="text-[11px] text-zinc-500 font-mono mt-1 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-zinc-400" />
                Wallet ownership verified via cryptographic challenge.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-zinc-400 uppercase mb-1.5">
              Approved Credit Facility (USDC)
            </label>
            <input
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              min="20"
              max="10000"
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-white/[0.08] text-zinc-100 font-mono text-sm focus:outline-none focus:border-zinc-500 transition tabular-nums"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-lg border border-white/[0.08] bg-transparent hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 px-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium transition shadow-sm"
            >
              {isSubmitting ? "Provisioning..." : "Authorize Facility"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
