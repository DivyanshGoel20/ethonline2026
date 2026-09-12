"use client";
import React, { useState, useEffect } from "react";
import {
  Activity,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  Zap,
  Coins,
  Cpu,
  RefreshCw,
  Clock,
  Radio,
} from "lucide-react";

interface LiveTransactionFeedProps {
  humanOwner?: string | null;
  refreshTrigger?: number;
}

interface TransactionItem {
  id: string;
  type: "x402_overdraft" | "drawdown" | "repayment" | "payment";
  title: string;
  agentAddress: string;
  amount: number;
  timestamp: number;
  timestampFormatted: string;
  txHash?: string;
  txLink?: string;
  status: string;
  isArcOnChain: boolean;
}

export const LiveTransactionFeed: React.FC<LiveTransactionFeedProps> = ({
  humanOwner,
  refreshTrigger = 0,
}) => {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchLiveTransactions = async () => {
    try {
      const telemetryUrl = humanOwner
        ? `/api/contract-telemetry?human=${encodeURIComponent(humanOwner)}`
        : "/api/contract-telemetry";

      const res = await fetch(telemetryUrl, { cache: "no-store" });
      const json = await res.json();

      if (!json.success || !json.telemetry) return;

      const t = json.telemetry;
      setLatestBlock(t.network?.latestBlock || null);

      const items: TransactionItem[] = [];

      // Add drawdowns (Arc Testnet On-Chain Loans / Overdrafts)
      if (Array.isArray(t.drawdowns)) {
        t.drawdowns.forEach((d: any) => {
          const isOverdraft = d.paymentReference?.includes("x402") || d.paymentReference?.includes("http");
          items.push({
            id: `drawdown_${d.loanId}`,
            type: isOverdraft ? "x402_overdraft" : "drawdown",
            title: isOverdraft ? "x402 Autonomous Overdraft" : "Arc Credit Drawdown",
            agentAddress: d.agentAddress,
            amount: d.amountUsdc,
            timestamp: d.timestamp * 1000,
            timestampFormatted: d.timestampIso ? new Date(d.timestampIso).toLocaleTimeString() : "Recent",
            txHash: d.txHash,
            txLink: d.txLink || (d.txHash ? `https://testnet.arcscan.app/tx/${d.txHash}` : undefined),
            status: d.status || "Confirmed",
            isArcOnChain: true,
          });
        });
      }

      // Add repayments (Arc Testnet On-Chain Repayments)
      if (Array.isArray(t.repayments)) {
        t.repayments.forEach((r: any) => {
          items.push({
            id: `repay_${r.repaymentId}`,
            type: "repayment",
            title: "On-Chain Facility Repayment",
            agentAddress: r.beneficiaryAgent || r.payer,
            amount: r.amountUsdc,
            timestamp: r.timestamp * 1000,
            timestampFormatted: r.timestampIso ? new Date(r.timestampIso).toLocaleTimeString() : "Recent",
            txHash: r.txHash,
            txLink: r.txHash ? `https://testnet.arcscan.app/tx/${r.txHash}` : undefined,
            status: "Settled",
            isArcOnChain: true,
          });
        });
      }

      // Sort newest first
      items.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(items);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn("[LiveTransactionFeed] Poll notice:", err);
    }
  };

  // Poll Arc Testnet telemetry every 7 seconds
  useEffect(() => {
    fetchLiveTransactions();
    const interval = setInterval(fetchLiveTransactions, 7000);
    return () => clearInterval(interval);
  }, [humanOwner, refreshTrigger]);

  return (
    <div className="fintech-card rounded-2xl p-5 sm:p-6 space-y-4 border border-white/[0.08] bg-[#0c0d12]/90 shadow-xl">
      {/* Header with Live Heartbeat */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Live Transaction & Agent Signing Stream
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>LIVE</span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              Real-time Arc Testnet block transactions & autonomous signing telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
          {latestBlock && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/[0.05]">
              <span className="text-[10px] text-zinc-500 uppercase">Block</span>
              <span className="text-zinc-200 font-bold">#{latestBlock}</span>
            </div>
          )}
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Stream Items */}
      <div className="space-y-2.5">
        {transactions.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-black/40 border border-dashed border-white/[0.08] space-y-2">
            <Cpu className="w-6 h-6 text-zinc-600 mx-auto" />
            <div className="text-xs font-medium text-zinc-400">
              Autonomous Signer Ready on Arc Testnet
            </div>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              No transactions executed yet for this profile. When an agent calls an x402 resource, borrows, or repays, the transaction will stream here in real time.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-white/[0.06] hover:border-white/[0.12] transition gap-2"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      tx.type === "x402_overdraft"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : tx.type === "repayment"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                    }`}
                  >
                    {tx.type === "x402_overdraft" ? (
                      <Zap className="w-3.5 h-3.5" />
                    ) : tx.type === "repayment" ? (
                      <Coins className="w-3.5 h-3.5" />
                    ) : (
                      <Activity className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-200">
                        {tx.title}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          tx.type === "repayment"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 mt-0.5">
                      <span>Agent:</span>
                      <span className="text-zinc-300">
                        {tx.agentAddress.slice(0, 6)}...{tx.agentAddress.slice(-4)}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-500">{tx.timestampFormatted}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-white/[0.04]">
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-white">
                      {tx.type === "repayment" ? "-" : "+"}
                      ${tx.amount.toFixed(2)} USDC
                    </span>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Arc Testnet
                    </div>
                  </div>

                  {tx.txHash ? (
                    <a
                      href={tx.txLink || `https://testnet.arcscan.app/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-mono transition"
                      title="View transaction on ArcScan Explorer"
                    >
                      <span>{tx.txHash.slice(0, 6)}...</span>
                      <ExternalLink className="w-3 h-3 text-zinc-400" />
                    </a>
                  ) : (
                    <a
                      href={`https://testnet.arcscan.app/address/${tx.agentAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[11px] font-mono transition"
                      title="View agent on ArcScan"
                    >
                      <span>ArcScan</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
