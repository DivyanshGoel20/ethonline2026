"use client";

import React, { useState, useEffect } from "react";
import { Agent } from "@/types";
import { X, ArrowDownLeft, AlertCircle } from "lucide-react";

interface BorrowModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBorrow: (agentAddress: string, amount: number) => Promise<void>;
}

export const BorrowModal: React.FC<BorrowModalProps> = ({
  agent,
  isOpen,
  onClose,
  onConfirmBorrow,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !agent) return null;

  const availableCredit = Math.max(0, agent.creditLimit - agent.outstandingDebt);
  const parsedAmount = parseFloat(amount) || 0;
  const isOverLimit = parsedAmount > availableCredit;
  const newDebt = agent.outstandingDebt + parsedAmount;
  const remainingHeadroom = Math.max(0, availableCredit - parsedAmount);

  const handlePercentage = (pct: number) => {
    const val = (availableCredit * pct).toFixed(2);
    setAmount(val);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setError("Please enter an amount greater than 0");
      return;
    }
    if (isOverLimit) {
      setError(`Amount exceeds available credit ($${availableCredit.toFixed(2)})`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmBorrow(agent.address, parsedAmount);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to execute borrow draw");
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
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Draw Credit Facility</h2>
              <p className="text-[11px] font-mono text-zinc-500">{agent.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Credit Context */}
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.04] flex items-center justify-between text-xs font-mono">
            <div>
              <div className="text-zinc-500 text-[10px] uppercase">Available Headroom</div>
              <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                ${availableCredit.toFixed(2)} USDC
              </div>
            </div>
            <div className="text-right">
              <div className="text-zinc-500 text-[10px] uppercase">Current Debt</div>
              <div className="text-sm font-medium text-zinc-300 mt-0.5">
                ${agent.outstandingDebt.toFixed(2)} USDC
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono text-zinc-400 uppercase">Draw Amount (USDC)</label>
              <div className="flex gap-1.5">
                {[0.25, 0.5, 1.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handlePercentage(pct)}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[10px] transition"
                  >
                    {pct === 1.0 ? "MAX" : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-white/[0.08] text-zinc-100 font-mono text-base focus:outline-none focus:border-zinc-500 transition tabular-nums"
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-mono text-zinc-500">USDC</span>
            </div>
          </div>

          {/* Breakdown / Impact */}
          {parsedAmount > 0 && (
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-white/[0.04] space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>New Debt Balance</span>
                <span className="text-zinc-200">${newDebt.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Remaining Headroom</span>
                <span className={remainingHeadroom === 0 ? "text-amber-400" : "text-zinc-200"}>
                  ${remainingHeadroom.toFixed(2)} USDC
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
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
              disabled={isSubmitting || parsedAmount <= 0 || isOverLimit}
              className="flex-1 py-2 px-3 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-zinc-950 text-xs font-medium transition shadow-sm"
            >
              {isSubmitting ? "Settling on Arc..." : "Confirm Draw"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
