"use client";

import React, { useState } from "react";
import { X, Bot, ShieldCheck, KeyRound, Check } from "lucide-react";
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
  const [tab, setTab] = useState<"existing" | "create">("existing");
  const [agentAddress, setAgentAddress] = useState("");
  const [agentName, setAgentName] = useState("");
  const [creditLimit, setCreditLimit] = useState("500");
  const [isVerifying, setIsVerifying] = useState(false);
  const [challengeSigned, setChallengeSigned] = useState(false);

  if (!isOpen) return null;

  const handleVerifyAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: tab === "existing" ? "add" : "create",
          agentAddress: tab === "existing" ? agentAddress : undefined,
          name: agentName || (tab === "existing" ? "Custom Agent" : "Platform AI Agent"),
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
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Manage Agents</h2>
            <p className="text-xs text-slate-400">Add an existing wallet or provision a platform agent</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5 mb-5 text-xs font-medium">
          <button
            onClick={() => setTab("existing")}
            className={`flex-1 py-2 rounded-lg transition ${
              tab === "existing"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Add Existing Agent
          </button>
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-2 rounded-lg transition ${
              tab === "create"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Create Through Float
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleVerifyAndAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Agent Name
            </label>
            <input
              type="text"
              placeholder="e.g. Research Agent or Arbitrage Bot"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500 transition"
            />
          </div>

          {tab === "existing" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Agent Wallet Address (EVM / Arc)
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={agentAddress}
                onChange={(e) => setAgentAddress(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-teal-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-teal-400" />
                Wallet must sign a one-time cryptographic challenge to prove ownership.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Initial Credit Limit (USDC)
            </label>
            <input
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              min="50"
              max="5000"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-teal-500 transition"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-sm font-semibold shadow-lg shadow-teal-500/10 transition active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <span>Verifying Signature & Settling...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{tab === "existing" ? "Verify & Add Agent" : "Create & Configure Agent"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
