"use client";

import React, { useState, useEffect } from "react";
import { Agent } from "@/types";
import { X, ArrowUpRight, AlertCircle, Zap, ShieldCheck, ExternalLink } from "lucide-react";
import { parseUnits } from "viem";

interface RepayModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmRepay: (agentAddress: string, amount: number, txHash?: string) => Promise<void>;
}

export const RepayModal: React.FC<RepayModalProps> = ({
  agent,
  isOpen,
  onClose,
  onConfirmRepay,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useBrowserWallet, setUseBrowserWallet] = useState(false);

  useEffect(() => {
    if (isOpen && agent) {
      setAmount(agent.outstandingDebt.toFixed(2));
      setError(null);
      // Auto-detect browser wallet if not autonomous
      if (typeof window !== "undefined" && (window as any).ethereum && !agent.isAutonomous) {
        setUseBrowserWallet(true);
      } else {
        setUseBrowserWallet(false);
      }
    }
  }, [isOpen, agent]);

  if (!isOpen || !agent) return null;

  const parsedAmount = parseFloat(amount) || 0;
  // Precision-safe comparison: allow +0.005 epsilon tolerance for floating-point math
  const isOverDebt = parsedAmount > agent.outstandingDebt + 0.005;
  const remainingDebt = Math.max(0, Math.round((agent.outstandingDebt - parsedAmount) * 100) / 100);

  // Approximate principal vs origination fee breakdown
  const estOriginationFee = Math.round((parsedAmount * (0.01 / 1.01)) * 1000) / 1000;
  const estPrincipal = Math.max(0, Math.round((parsedAmount - estOriginationFee) * 1000) / 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setError("Please enter an amount greater than 0");
      return;
    }
    if (isOverDebt) {
      setError(`Repayment exceeds total outstanding debt ($${agent.outstandingDebt.toFixed(2)})`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let clientTxHash: string | undefined = undefined;

      // If user chooses browser wallet payment on Arc Testnet
      if (useBrowserWallet && typeof window !== "undefined" && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;
        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        const fromAccount = accounts[0];

        // Facility Operator Treasury
        const facilityTreasury = "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3";
        const valueHex = "0x" + parseUnits(parsedAmount.toFixed(6), 18).toString(16);

        clientTxHash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: fromAccount,
              to: facilityTreasury,
              value: valueHex,
            },
          ],
        });
      }

      // Safe clamp: ensure we never submit more than the stored outstandingDebt
      const effectiveAmount = Math.min(parsedAmount, agent.outstandingDebt);
      await onConfirmRepay(agent.address, effectiveAmount, clientTxHash);
      onClose();
    } catch (err: any) {
      console.error("[RepayModal] Submission error:", err);
      setError(err.shortMessage || err.message || "Failed to settle repayment");
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
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Repay Credit Facility</h2>
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
          {/* Debt Context */}
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.04] flex items-center justify-between text-xs font-mono">
            <div>
              <div className="text-zinc-500 text-[10px] uppercase">Outstanding Debt</div>
              <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                ${agent.outstandingDebt.toFixed(2)} USDC
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAmount(agent.outstandingDebt.toFixed(2));
                setError(null);
              }}
              className="text-[11px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 transition"
            >
              Pay Full Debt
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-mono text-zinc-400 uppercase mb-1.5">
              Repayment Amount (USDC)
            </label>
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

          {/* Real On-Chain Settlement Mode */}
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-white/[0.05] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                {agent.isAutonomous ? (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Autonomous Self-Signing</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Real Arc Settlement</span>
                  </>
                )}
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Arc Testnet (5042002)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {agent.isAutonomous
                ? "This agent signs with its own on-chain wallet. Real native USDC will be deducted directly from its address on Arc Testnet."
                : "Real USDC tokens are transferred on Arc Testnet to settle your credit facility and restore available headroom."}
            </p>
          </div>

          {/* Impact preview */}
          {parsedAmount > 0 && (
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-white/[0.04] space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Principal Settled</span>
                <span className="text-zinc-200">${estPrincipal.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Interest & Origination Fee</span>
                <span className="text-amber-400">${estOriginationFee.toFixed(2)} USDC</span>
              </div>
              <div className="border-t border-white/[0.05] pt-1 flex justify-between text-zinc-400">
                <span>Remaining Debt</span>
                <span className="text-zinc-200">${remainingDebt.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Restored Headroom</span>
                <span className="text-emerald-400">
                  +${Math.min(agent.outstandingDebt, parsedAmount).toFixed(2)} USDC
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
              disabled={isSubmitting || parsedAmount <= 0 || isOverDebt}
              className="flex-1 py-2 px-3 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-zinc-950 text-xs font-medium transition shadow-sm"
            >
              {isSubmitting ? "Settling on Arc..." : "Confirm Repayment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
