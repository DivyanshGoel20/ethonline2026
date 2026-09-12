"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  Copy,
  Check,
  AlertTriangle,
  ArrowUpRight,
  TrendingDown,
} from "lucide-react";

interface TelemetryData {
  network: {
    name: string;
    chainId: number;
    rpcUrl: string;
    latestBlock: number;
  };
  contract: {
    address: string;
    owner: string;
    explorerUrl: string;
  };
  profile: {
    profileId: string;
    humanOwner: string;
    humanRoot: string;
    creditLimit: number;
    creditLimitRaw: string;
    outstandingDebt: number;
    outstandingDebtRaw: string;
    remainingCredit: number;
    remainingCreditRaw: string;
    totalBorrowed: number;
    totalBorrowedRaw: string;
    totalRepaid: number;
    totalRepaidRaw: string;
    statusCode: number;
    status: string;
    createdAtTimestamp: number;
    createdAtIso: string;
  } | null;
  authorizedAgents: Array<{
    agentAddress: string;
    isAuthorized: boolean;
    authorizedAtTimestamp: number;
    authorizedAtIso: string;
    profileId: string;
  }>;
  drawdowns: Array<{
    loanId: number;
    profileId: string;
    agentAddress: string;
    amountRaw: string;
    amountUsdc: number;
    timestamp: number;
    timestampIso: string;
    statusCode: number;
    status: string;
    paymentReference: string;
    arcscanUrl: string;
    txHash?: string;
    txLink?: string;
  }>;
  repayments: Array<{
    repaymentId: number;
    profileId: string;
    payer: string;
    beneficiaryAgent: string;
    amountRaw: string;
    amountUsdc: number;
    timestamp: number;
    timestampIso: string;
  }>;
  totalDrawdownsCount: number;
  totalRepaymentsCount: number;
}

interface SmartContractTelemetryProps {
  humanOwner?: string | null;
  refreshTrigger?: number;
}

export const SmartContractTelemetry: React.FC<SmartContractTelemetryProps> = ({ humanOwner, refreshTrigger = 0 }) => {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "agents" | "loans" | "repayments">("profile");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchTelemetry = async (manual: boolean = false) => {
    if (manual) setIsRefreshing(true);
    setError(null);

    try {
      const url = humanOwner
        ? `/api/contract-telemetry?human=${encodeURIComponent(humanOwner)}`
        : "/api/contract-telemetry";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to fetch on-chain contract telemetry");
      }
      setData(json.telemetry);
    } catch (err: any) {
      console.error("[Telemetry] Error fetching smart contract state:", err);
      setError(err.message || "Failed to query Arc Testnet RPC");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(() => {
      fetchTelemetry(false);
    }, 7000);
    return () => clearInterval(interval);
  }, [humanOwner, refreshTrigger]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fintech-card rounded-2xl border border-white/[0.08] bg-[#0c0e14] overflow-hidden">
      {/* Header bar */}
      <div className="px-6 py-5 border-b border-white/[0.06] bg-black/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white font-sans">
                Arc Testnet Smart Contract Telemetry
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live On-Chain
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Direct telemetry from <code className="font-mono text-zinc-300">FloatCreditFacility.sol</code> on Arc Testnet (EVM)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {data?.network?.latestBlock && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-white/[0.06] text-xs font-mono text-zinc-400">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>Block #{data.network.latestBlock.toLocaleString()}</span>
            </div>
          )}

          <a
            href={data?.contract?.explorerUrl || "https://testnet.arcscan.app/address/0xAa2d23bAC7b6f9b4ca2737252F924b3F485E0686"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-xs font-mono text-zinc-300 hover:text-white transition"
          >
            <span>0xAa2d...0686</span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </a>

          <button
            onClick={() => fetchTelemetry(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-medium text-emerald-300 transition active:scale-[0.98] disabled:opacity-50"
            title="Re-query Arc Testnet smart contract state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Querying..." : "Refresh State"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] bg-black/20 px-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("profile")}
          className={`py-3 px-4 text-xs font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "profile"
              ? "border-emerald-400 text-emerald-300 bg-emerald-500/[0.04]"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Human Credit Profile</span>
        </button>

        <button
          onClick={() => setActiveTab("agents")}
          className={`py-3 px-4 text-xs font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "agents"
              ? "border-emerald-400 text-emerald-300 bg-emerald-500/[0.04]"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Authorized Agents ({data?.authorizedAgents?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("loans")}
          className={`py-3 px-4 text-xs font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "loans"
              ? "border-emerald-400 text-emerald-300 bg-emerald-500/[0.04]"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>On-Chain Loans / Drawdowns ({data?.drawdowns?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("repayments")}
          className={`py-3 px-4 text-xs font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "repayments"
              ? "border-emerald-400 text-emerald-300 bg-emerald-500/[0.04]"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>On-Chain Repayments ({data?.repayments?.length || 0})</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-zinc-500 font-mono space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400" />
            <p>Querying Arc Testnet RPC (Block, Profile, Authorizations & Drawdowns)...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* TAB 1: Human Credit Profile */}
            {activeTab === "profile" && data?.profile && (
              <div className="space-y-6">
                {/* Metric Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06]">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                      On-Chain Credit Limit
                    </div>
                    <div className="text-xl font-bold text-white font-mono mt-1 tabular-nums">
                      ${data.profile.creditLimit.toFixed(2)} USDC
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      Raw: {data.profile.creditLimitRaw}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06]">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                      Outstanding Debt
                    </div>
                    <div className="text-xl font-bold text-amber-400 font-mono mt-1 tabular-nums">
                      ${data.profile.outstandingDebt.toFixed(2)} USDC
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      Raw: {data.profile.outstandingDebtRaw}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06]">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                      Remaining Credit
                    </div>
                    <div className="text-xl font-bold text-emerald-400 font-mono mt-1 tabular-nums">
                      ${data.profile.remainingCredit.toFixed(2)} USDC
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      Raw: {data.profile.remainingCreditRaw}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06]">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                      Profile Status
                    </div>
                    <div className="text-xl font-bold text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{data.profile.status}</span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      Code: {data.profile.statusCode}
                    </div>
                  </div>
                </div>

                {/* Detailed On-Chain Fields Table */}
                <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-black/30">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-white/[0.02] border-b border-white/[0.06] text-zinc-400">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold text-[11px]">Storage Slot / Field</th>
                        <th className="py-2.5 px-4 font-semibold text-[11px]">On-Chain Value</th>
                        <th className="py-2.5 px-4 font-semibold text-[11px] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      <tr>
                        <td className="py-3 px-4 text-zinc-400 font-sans font-medium">Contract Address</td>
                        <td className="py-3 px-4 text-zinc-200">{data.contract.address}</td>
                        <td className="py-3 px-4 text-right">
                          <a
                            href={data.contract.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                          >
                            <span>ArcScan</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>

                      <tr>
                        <td className="py-3 px-4 text-zinc-400 font-sans font-medium">Profile ID (bytes32)</td>
                        <td className="py-3 px-4 text-zinc-200 break-all">{data.profile.profileId}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleCopy(data.profile!.profileId, "profileId")}
                            className="text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
                          >
                            {copiedKey === "profileId" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === "profileId" ? "Copied" : "Copy"}</span>
                          </button>
                        </td>
                      </tr>

                      <tr>
                        <td className="py-3 px-4 text-zinc-400 font-sans font-medium">Human Owner Address</td>
                        <td className="py-3 px-4 text-zinc-200">
                          <a
                            href={`https://testnet.arcscan.app/address/${data.profile.humanOwner}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline"
                          >
                            {data.profile.humanOwner}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleCopy(data.profile!.humanOwner, "humanOwner")}
                            className="text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
                          >
                            {copiedKey === "humanOwner" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === "humanOwner" ? "Copied" : "Copy"}</span>
                          </button>
                        </td>
                      </tr>

                      <tr>
                        <td className="py-3 px-4 text-zinc-400 font-sans font-medium">Human Root (World ID Commit)</td>
                        <td className="py-3 px-4 text-zinc-300 break-all">{data.profile.humanRoot}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleCopy(data.profile!.humanRoot, "humanRoot")}
                            className="text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
                          >
                            {copiedKey === "humanRoot" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === "humanRoot" ? "Copied" : "Copy"}</span>
                          </button>
                        </td>
                      </tr>

                      <tr>
                        <td className="py-3 px-4 text-zinc-400 font-sans font-medium">Cumulative Borrowed / Repaid</td>
                        <td className="py-3 px-4 text-zinc-200">
                          Borrowed: <span className="text-white font-semibold">${data.profile.totalBorrowed.toFixed(2)} USDC</span> | Repaid: <span className="text-emerald-400 font-semibold">${data.profile.totalRepaid.toFixed(2)} USDC</span>
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-500">On-Chain Ledger</td>
                      </tr>

                      <tr>
                        <td className="py-3 px-4 text-zinc-400 font-sans font-medium">Profile Creation Block Time</td>
                        <td className="py-3 px-4 text-zinc-200">
                          {data.profile.createdAtIso} ({data.profile.createdAtTimestamp})
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Block Timestamp
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Authorized Agents */}
            {activeTab === "agents" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-black/30">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-white/[0.02] border-b border-white/[0.06] text-zinc-400">
                      <tr>
                        <th className="py-3 px-4 font-semibold text-[11px]">Agent EVM Address</th>
                        <th className="py-3 px-4 font-semibold text-[11px]">On-Chain Status</th>
                        <th className="py-3 px-4 font-semibold text-[11px]">Authorized Block Timestamp</th>
                        <th className="py-3 px-4 font-semibold text-[11px] text-right">ArcScan Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {data?.authorizedAgents?.map((agent) => (
                        <tr key={agent.agentAddress} className="hover:bg-white/[0.01] transition">
                          <td className="py-3 px-4 text-zinc-200 font-semibold flex items-center gap-2">
                            <span>{agent.agentAddress}</span>
                            <button
                              onClick={() => handleCopy(agent.agentAddress, agent.agentAddress)}
                              className="text-zinc-500 hover:text-zinc-300"
                              title="Copy Address"
                            >
                              {copiedKey === agent.agentAddress ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            {agent.isAuthorized ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Authorized on Arc
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px]">
                                Not Authorized
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-zinc-400">
                            {agent.authorizedAtIso}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <a
                              href={`https://testnet.arcscan.app/address/${agent.agentAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 text-[11px]"
                            >
                              <span>View Explorer</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: On-Chain Drawdowns / Loans */}
            {activeTab === "loans" && (
              <div className="space-y-4">
                {data?.drawdowns && data.drawdowns.length > 0 ? (
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-black/30">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-white/[0.02] border-b border-white/[0.06] text-zinc-400">
                        <tr>
                          <th className="py-3 px-4 font-semibold text-[11px]">Loan ID</th>
                          <th className="py-3 px-4 font-semibold text-[11px]">Beneficiary Agent</th>
                          <th className="py-3 px-4 font-semibold text-[11px]">Amount</th>
                          <th className="py-3 px-4 font-semibold text-[11px]">Status</th>
                          <th className="py-3 px-4 font-semibold text-[11px]">Payment Reference</th>
                          <th className="py-3 px-4 font-semibold text-[11px]">Timestamp</th>
                          <th className="py-3 px-4 font-semibold text-[11px] text-right">Arc Testnet Tx</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {data.drawdowns.map((d) => (
                          <tr key={d.loanId} className="hover:bg-white/[0.01] transition">
                            <td className="py-3.5 px-4 font-bold text-white">#{d.loanId}</td>
                            <td className="py-3.5 px-4 text-zinc-300">
                              <a
                                href={`https://testnet.arcscan.app/address/${d.agentAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:underline"
                              >
                                {d.agentAddress.slice(0, 8)}...{d.agentAddress.slice(-6)}
                              </a>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-emerald-300 tabular-nums">
                              ${d.amountUsdc.toFixed(4)} USDC
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold">
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-zinc-400 max-w-xs truncate" title={d.paymentReference}>
                              {d.paymentReference}
                            </td>
                            <td className="py-3.5 px-4 text-zinc-400">
                              {d.timestampIso}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {d.txHash ? (
                                <a
                                  href={`https://testnet.arcscan.app/tx/${d.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:text-emerald-200 underline font-semibold inline-flex items-center gap-1"
                                  title="View on ArcScan Explorer"
                                >
                                  <span>{d.txHash.slice(0, 8)}...{d.txHash.slice(-6)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <a
                                  href={`https://testnet.arcscan.app/address/${d.agentAddress}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
                                >
                                  <span>Mined On Arc</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-zinc-500 font-mono">
                    No on-chain drawdowns recorded yet.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: On-Chain Repayments */}
            {activeTab === "repayments" && (
              <div className="space-y-4">
                {data?.repayments && data.repayments.length > 0 ? (
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-black/30">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-white/[0.02] border-b border-white/[0.06] text-zinc-400">
                        <tr>
                          <th className="py-3 px-4 font-semibold text-[11px]">Repayment ID</th>
                          <th className="py-3 px-4 font-semibold text-[11px]">Payer</th>
                          <th className="py-3 px-4 font-semibold text-[11px]">Beneficiary Agent</th>
                          <th className="py-3 px-4 font-semibold text-[11px]">Amount</th>
                          <th className="py-3 px-4 font-semibold text-[11px]">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {data.repayments.map((r) => (
                          <tr key={r.repaymentId}>
                            <td className="py-3 px-4 font-bold text-white">#{r.repaymentId}</td>
                            <td className="py-3 px-4 text-zinc-300">{r.payer}</td>
                            <td className="py-3 px-4 text-zinc-300">{r.beneficiaryAgent}</td>
                            <td className="py-3 px-4 text-emerald-400 font-semibold">${r.amountUsdc.toFixed(2)} USDC</td>
                            <td className="py-3 px-4 text-zinc-400">{r.timestampIso}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-zinc-500 font-mono">
                    No on-chain repayments recorded yet in contract storage.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
