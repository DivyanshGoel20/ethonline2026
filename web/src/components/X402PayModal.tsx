"use client";

import React, { useState, useEffect } from "react";
import { Agent } from "@/types";
import {
  X,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Coins,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface X402PayModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (result: any) => void;
}

type StepState = "idle" | "running" | "done" | "error";

export const X402PayModal: React.FC<X402PayModalProps> = ({
  agent,
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  const [url, setUrl] = useState("http://localhost:3000/premium-data");
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<any | null>(null);

  // Live Gateway balance state
  const [gatewayBalance, setGatewayBalance] = useState<string>("0.00");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);

  // Animated execution steps
  const [steps, setSteps] = useState<
    Array<{ id: string; label: string; state: StepState; detail?: string }>
  >([
    {
      id: "402",
      label: "Requesting API resource (HTTP 402)",
      state: "idle",
      detail: "Receiving Circle Gateway batching payment challenge",
    },
    {
      id: "balance",
      label: "Inspecting Agent Circle Gateway balance",
      state: "idle",
      detail: "Detecting $0.00 balance (Shortfall detected)",
    },
    {
      id: "facility",
      label: "Float Credit Facility evaluation",
      state: "idle",
      detail: "Approving $0.01 USDC overdraft on Arc Testnet",
    },
    {
      id: "sign",
      label: "FloatSigner autonomous authorization",
      state: "idle",
      detail: "Signing x402 payment from Float facility account",
    },
    {
      id: "settle",
      label: "Circle Gateway settlement & HTTP 200 unlocked",
      state: "idle",
      detail: "Live settlement on Arc Testnet (5042002)",
    },
  ]);

  // Load live agent gateway balance on open
  useEffect(() => {
    if (isOpen && agent) {
      setPaymentResult(null);
      setError(null);
      resetSteps();
      fetchGatewayBalance(agent.address);
    }
  }, [isOpen, agent]);

  const resetSteps = () => {
    setSteps([
      {
        id: "402",
        label: "Requesting API resource (HTTP 402)",
        state: "idle",
        detail: "Receiving Circle Gateway batching payment challenge",
      },
      {
        id: "balance",
        label: "Inspecting Agent Circle Gateway balance",
        state: "idle",
        detail: "Detecting $0.00 balance (Shortfall detected)",
      },
      {
        id: "facility",
        label: "Float Credit Facility evaluation",
        state: "idle",
        detail: "Approving $0.01 USDC overdraft on Arc Testnet",
      },
      {
        id: "sign",
        label: "FloatSigner autonomous authorization",
        state: "idle",
        detail: "Signing x402 payment from Float facility account",
      },
      {
        id: "settle",
        label: "Circle Gateway settlement & HTTP 200 unlocked",
        state: "idle",
        detail: "Live settlement on Arc Testnet (5042002)",
      },
    ]);
  };

  const fetchGatewayBalance = async (address: string) => {
    setIsLoadingBalance(true);
    try {
      const res = await fetch(`/api/pay?agentAddress=${address}`);
      const data = await res.json();
      if (data.gatewayAvailableUSDC !== undefined) {
        setGatewayBalance(data.gatewayAvailableUSDC);
      }
    } catch {
      setGatewayBalance("0.00");
    } finally {
      setIsLoadingBalance(false);
    }
  };

  if (!isOpen || !agent) return null;

  const availableCredit = Math.max(0, agent.creditLimit - agent.outstandingDebt);

  const handlePay = async () => {
    setIsPaying(true);
    setError(null);
    setPaymentResult(null);

    // Step 1: 402 challenge
    setSteps((s) =>
      s.map((step) =>
        step.id === "402" ? { ...step, state: "running" } : step
      )
    );

    try {
      // Step 2 progression
      setTimeout(() => {
        setSteps((s) =>
          s.map((step) =>
            step.id === "402"
              ? { ...step, state: "done" }
              : step.id === "balance"
              ? { ...step, state: "running" }
              : step
          )
        );
      }, 400);

      // Step 3 progression
      setTimeout(() => {
        setSteps((s) =>
          s.map((step) =>
            step.id === "balance"
              ? { ...step, state: "done" }
              : step.id === "facility"
              ? { ...step, state: "running" }
              : step
          )
        );
      }, 900);

      // Step 4 progression
      setTimeout(() => {
        setSteps((s) =>
          s.map((step) =>
            step.id === "facility"
              ? { ...step, state: "done" }
              : step.id === "sign"
              ? { ...step, state: "running" }
              : step
          )
        );
      }, 1400);

      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          agentAddress: agent.address,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment execution failed");
      }

      // Mark all completed
      setSteps((s) =>
        s.map((step) => ({ ...step, state: "done" }))
      );

      setPaymentResult(data);
      onPaymentSuccess?.(data);
    } catch (err: any) {
      console.error("Overdraft payment error:", err);
      setError(err.message || "Failed to execute overdraft payment");
      setSteps((s) =>
        s.map((step) =>
          step.state === "running" ? { ...step, state: "error" } : step
        )
      );
    } finally {
      setIsPaying(false);
    }
  };

  const copyTxId = (txId: string) => {
    navigator.clipboard.writeText(txId);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#0f0f13] border border-white/[0.08] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  x402 Agent Overdraft
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                  FloatSigner Live
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                <span>Agent:</span>
                <span className="font-mono text-zinc-300 font-medium">{agent.name}</span>
                <span className="font-mono text-zinc-500 text-[11px]">
                  ({agent.address.slice(0, 6)}...{agent.address.slice(-4)})
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 pt-4">
          {/* Target Service URL */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              x402 Premium API Endpoint
            </label>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isPaying}
                placeholder="http://localhost:3000/premium-data"
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500/50 transition pr-16"
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-zinc-500 font-medium">
                0.01 USDC
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Calls the Circle seller service that requires an x402 payment header.
            </p>
          </div>

          {/* Real Financial Status Matrix */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Agent Gateway Balance */}
            <div className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">Agent Gateway Balance</span>
                <Coins className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-base font-semibold text-white font-mono">
                  ${isLoadingBalance ? "..." : gatewayBalance}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase font-mono">USDC</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-400">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>Zero funds in Gateway</span>
              </div>
            </div>

            {/* Float Credit Headroom */}
            <div className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">Float Facility Available</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-base font-semibold text-emerald-400 font-mono">
                  ${availableCredit.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase font-mono">USDC</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-1">
                Backed by Arc Credit Facility
              </div>
            </div>
          </div>

          {/* Overdraft Mechanism Explainer Banner */}
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-zinc-300 space-y-0.5 leading-relaxed">
              <span className="font-semibold text-amber-300">How Float Overdraft works:</span>
              <p className="text-[11px] text-zinc-400">
                Normally, <code className="text-zinc-300">circle services pay</code> fails when the agent has 0 balance.
                With <strong className="text-zinc-200">FloatSigner</strong>, Float detects the $0.01 shortfall, signs the payment authorization from Float&apos;s funded facility on Arc Testnet, and records $0.01 debt on the agent&apos;s credit profile.
              </p>
            </div>
          </div>

          {/* Step visualizer (visible while paying or after completion) */}
          {(isPaying || paymentResult || error) && (
            <div className="space-y-2 p-3.5 bg-black/50 border border-white/[0.06] rounded-xl">
              <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center justify-between">
                <span>Execution State Machine</span>
                {isPaying && (
                  <span className="flex items-center gap-1.5 text-amber-400 text-[10px]">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Settling live on Arc...
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-2.5 text-xs transition-colors"
                  >
                    <div className="mt-0.5">
                      {step.state === "done" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      {step.state === "running" && (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                      )}
                      {step.state === "error" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[10px] font-bold">
                          ✕
                        </div>
                      )}
                      {step.state === "idle" && (
                        <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 bg-zinc-900" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div
                        className={`font-medium ${
                          step.state === "done"
                            ? "text-zinc-200"
                            : step.state === "running"
                            ? "text-amber-300 font-semibold"
                            : step.state === "error"
                            ? "text-rose-400"
                            : "text-zinc-600"
                        }`}
                      >
                        {step.label}
                      </div>
                      {step.detail && (
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Payload Display */}
          {paymentResult && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>HTTP 200 OK — Premium API Data Unlocked!</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                  Overdraft Settled
                </span>
              </div>

              {/* Arc Testnet On-Chain Drawdown Transaction */}
              {(paymentResult.arcTxHash || (paymentResult.transactionId && paymentResult.transactionId.startsWith("0x"))) && (
                <div className="flex items-center justify-between text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-2 rounded-lg">
                  <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Arc Testnet Tx:</span>
                  </span>
                  <a
                    href={paymentResult.arcTxLink || `https://testnet.arcscan.app/tx/${paymentResult.arcTxHash || paymentResult.transactionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-200 flex items-center gap-1 font-semibold underline decoration-emerald-500/40 transition"
                    title="View Transaction on ArcScan"
                  >
                    <span>{(paymentResult.arcTxHash || paymentResult.transactionId).slice(0, 10)}...{(paymentResult.arcTxHash || paymentResult.transactionId).slice(-8)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Circle Gateway Settlement UUID */}
              {(paymentResult.circleSettlementId || (!paymentResult.transactionId?.startsWith("0x") && paymentResult.transactionId)) && (
                <div className="flex items-center justify-between text-[11px] font-mono bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/[0.05]">
                  <span className="text-zinc-400">Circle Gateway Settle ID:</span>
                  <button
                    onClick={() => copyTxId(paymentResult.circleSettlementId || paymentResult.transactionId)}
                    className="text-zinc-300 hover:text-white flex items-center gap-1 transition"
                  >
                    <span>{(paymentResult.circleSettlementId || paymentResult.transactionId).slice(0, 16)}...</span>
                    {copiedTx ? (
                      <Check className="w-3 h-3 text-emerald-300" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-500" />
                    )}
                  </button>
                </div>
              )}

              {/* Payer Facility */}
              <div className="flex items-center justify-between text-[11px] font-mono bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/[0.05]">
                <span className="text-zinc-400">Payer (Funded Wallet):</span>
                <a
                  href={`https://testnet.arcscan.app/address/${paymentResult.payer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                  title="View on ArcScan Explorer"
                >
                  <span>{paymentResult.payer ? `${paymentResult.payer.slice(0, 8)}...${paymentResult.payer.slice(-6)}` : "Funded Wallet"}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Arc Credit Facility */}
              <div className="flex items-center justify-between text-[11px] font-mono bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/[0.05]">
                <span className="text-zinc-400">Arc Credit Facility:</span>
                <a
                  href={`https://testnet.arcscan.app/address/${paymentResult.creditFacilityAddress || "0xAa2d23bAC7b6f9b4ca2737252F924b3F485E0686"}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-300 hover:text-white flex items-center gap-1 transition"
                  title="View Contract on ArcScan"
                >
                  <span>0xAa2d...0686</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </a>
              </div>

              {/* API Unlocked Payload */}
              <div>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                  Returned API Payload:
                </span>
                <pre className="mt-1 p-2.5 rounded-lg bg-black/60 border border-white/[0.05] text-[11px] font-mono text-emerald-300 overflow-x-auto">
                  {JSON.stringify(paymentResult.data, null, 2)}
                </pre>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-300 pt-1 border-t border-emerald-500/10">
                <span>New Agent Debt:</span>
                <span className="font-mono font-bold text-amber-400">
                  ${(paymentResult.agentDebt || 0.01).toFixed(2)} USDC
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <span className="font-semibold">Execution Failed:</span> {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-medium border border-white/[0.06] transition"
          >
            {paymentResult ? "Close" : "Cancel"}
          </button>

          {!paymentResult ? (
            <button
              onClick={handlePay}
              disabled={isPaying || availableCredit < 0.01}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isPaying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Settling via Float Overdraft...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-black" />
                  <span>Pay x402 with Float Overdraft</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                setPaymentResult(null);
                resetSteps();
                fetchGatewayBalance(agent.address);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Test Another Payment</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
