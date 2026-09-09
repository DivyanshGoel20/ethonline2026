"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { CreditStats } from "@/components/CreditStats";
import { AgentCard } from "@/components/AgentCard";
import { BorrowModal } from "@/components/BorrowModal";
import { RepayModal } from "@/components/RepayModal";
import { AddAgentModal } from "@/components/AddAgentModal";
import { ApiModal } from "@/components/ApiModal";
import { WorldAuthGate } from "@/components/WorldAuthGate";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Agent, CreditStats as CreditStatsType, ActivityItem } from "@/types";
import { Search, LayoutGrid, List, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "debt" | "clean">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // World Verification state
  const [isWorldVerified, setIsWorldVerified] = useState(false);
  const [nullifierHash, setNullifierHash] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Modals state
  const [selectedBorrowAgent, setSelectedBorrowAgent] = useState<Agent | null>(null);
  const [selectedRepayAgent, setSelectedRepayAgent] = useState<Agent | null>(null);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isApiDocsOpen, setIsApiDocsOpen] = useState(false);

  // Live Activity Log
  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: "act-1",
      type: "repay",
      agentName: "Research Agent",
      agentAddress: "0x913a80277353f88f8d68bc3eefbb4806a6b878f2",
      amount: 40,
      timestamp: Date.now() - 1000 * 60 * 12,
      txHash: "0xarc_repay_01",
    },
    {
      id: "act-2",
      type: "borrow",
      agentName: "Procurement Agent",
      agentAddress: "0x42f7c02b36a8e809311bc4c80b98024220b2491a",
      amount: 180,
      timestamp: Date.now() - 1000 * 60 * 45,
      txHash: "0xarc_borrow_02",
    },
    {
      id: "act-3",
      type: "register",
      agentName: "x402 Market Agent",
      agentAddress: "0x2222222222222222222222222222222222222222",
      timestamp: Date.now() - 1000 * 60 * 180,
      txHash: "0xarc_reg_03",
    },
  ]);

  // Subtle toast feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "neutral" } | null>(null);

  const showToast = (message: string, type: "success" | "neutral" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Restore session if previously verified in browser
    const storedSession = localStorage.getItem("float_world_session");
    if (storedSession) {
      setIsWorldVerified(true);
      setNullifierHash(storedSession);
    }
    setIsLoadingSession(false);

    // Fetch initial agents
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (data.agents) setAgents(data.agents);
      })
      .catch((err) => console.error(err));
  }, []);

  // Aggregate stats calculations
  const totalAvailableCredit = agents.reduce(
    (acc, a) => acc + Math.max(0, a.creditLimit - a.outstandingDebt),
    0
  );
  const totalCreditUsed = agents.reduce((acc, a) => acc + a.outstandingDebt, 0);
  const totalOutstandingDebt = totalCreditUsed;
  const totalBorrowed = agents.reduce((acc, a) => acc + a.totalBorrowed, 0);
  const totalRepaid = agents.reduce((acc, a) => acc + a.totalRepaid, 0);

  const stats: CreditStatsType = {
    totalAvailableCredit,
    totalCreditUsed,
    totalOutstandingDebt,
    totalBorrowed,
    totalRepaid,
    activeAgentsCount: agents.length,
  };

  // Filtered agents
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.address.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "debt") return agent.outstandingDebt > 0;
    if (statusFilter === "clean") return agent.outstandingDebt === 0;
    return true;
  });

  // Handle Borrow
  const handleConfirmBorrow = async (agentAddress: string, amount: number) => {
    const res = await fetch("/api/agent/borrow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentAddress, amount }),
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to execute borrow draw");
    }

    const targetAgent = agents.find(
      (a) => a.address.toLowerCase() === agentAddress.toLowerCase()
    );

    setAgents((prev) =>
      prev.map((a) =>
        a.address.toLowerCase() === agentAddress.toLowerCase()
          ? {
              ...a,
              outstandingDebt: a.outstandingDebt + amount,
              totalBorrowed: a.totalBorrowed + amount,
              currentBalance: a.currentBalance + amount,
            }
          : a
      )
    );

    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        type: "borrow",
        agentName: targetAgent?.name || "Agent",
        agentAddress,
        amount,
        timestamp: Date.now(),
        txHash: data.txHash || "0xarc_draw",
      },
      ...prev,
    ]);

    showToast(`Drawn $${amount.toFixed(2)} USDC for ${targetAgent?.name || "Agent"}`);
  };

  // Handle Repay
  const handleConfirmRepay = async (agentAddress: string, amount: number) => {
    const res = await fetch("/api/agent/repay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentAddress, amount }),
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to settle repayment");
    }

    const targetAgent = agents.find(
      (a) => a.address.toLowerCase() === agentAddress.toLowerCase()
    );

    setAgents((prev) =>
      prev.map((a) =>
        a.address.toLowerCase() === agentAddress.toLowerCase()
          ? {
              ...a,
              outstandingDebt: Math.max(0, a.outstandingDebt - amount),
              totalRepaid: a.totalRepaid + amount,
            }
          : a
      )
    );

    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        type: "repay",
        agentName: targetAgent?.name || "Agent",
        agentAddress,
        amount,
        timestamp: Date.now(),
        txHash: data.txHash || "0xarc_repay",
      },
      ...prev,
    ]);

    showToast(`Settled $${amount.toFixed(2)} USDC repayment for ${targetAgent?.name || "Agent"}`);
  };

  // Handle Add Agent
  const handleAgentAdded = (newAgent: Agent) => {
    setAgents((prev) => [newAgent, ...prev]);
    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        type: "register",
        agentName: newAgent.name,
        agentAddress: newAgent.address,
        timestamp: Date.now(),
        txHash: "0xarc_register",
      },
      ...prev,
    ]);
    showToast(`Provisioned facility for ${newAgent.name}`);
  };

  // Handle World Verification Passed
  const handleWorldVerified = (hash: string) => {
    localStorage.setItem("float_world_session", hash);
    setIsWorldVerified(true);
    setNullifierHash(hash);
    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        type: "register",
        agentName: "World Selfie Check",
        agentAddress: hash,
        timestamp: Date.now(),
        txHash: "0xworld_selfie_liveness_verified",
      },
      ...prev,
    ]);
    showToast("Human operator verified via World Selfie Check");
  };

  // Handle Sign Out / Disconnect
  const handleSignOut = () => {
    localStorage.removeItem("float_world_session");
    setIsWorldVerified(false);
    setNullifierHash(null);
    showToast("Signed out of World ID session", "neutral");
  };

  // Loading state while checking local session
  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-zinc-500 font-mono text-xs">
        Checking verification session...
      </div>
    );
  }

  // 1. GATEKEEPER: User CANNOT see the dashboard until passing Selfie Check
  if (!isWorldVerified) {
    return <WorldAuthGate onVerified={handleWorldVerified} />;
  }

  // 2. DASHBOARD: Only unlocked after Selfie Check passes
  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100 bg-grid-pattern">
      <Header
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
        onOpenApiDocs={() => setIsApiDocsOpen(true)}
        onSignOut={handleSignOut}
        isWorldVerified={isWorldVerified}
        nullifierHash={nullifierHash}
        activeAgentsCount={agents.length}
      />

      {/* Subtle toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 py-2 px-3.5 rounded-lg bg-[#16161c] border border-white/[0.1] text-zinc-200 text-xs font-mono shadow-2xl flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{toast.message}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* Top Metric Bar */}
        <section>
          <CreditStats stats={stats} />
        </section>

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-start">
          {/* Left 2 Cols: Agents Management */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filter and View Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search agents or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#111115] border border-white/[0.08] text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono transition"
                />
              </div>

              {/* Status pills + view switch */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-1 bg-[#111115] p-1 rounded-lg border border-white/[0.06] text-[11px] font-mono">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-2.5 py-1 rounded-md transition ${
                      statusFilter === "all"
                        ? "bg-zinc-800 text-zinc-100 font-medium"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    All ({agents.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("debt")}
                    className={`px-2.5 py-1 rounded-md transition ${
                      statusFilter === "debt"
                        ? "bg-zinc-800 text-zinc-100 font-medium"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Drawn ({agents.filter((a) => a.outstandingDebt > 0).length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("clean")}
                    className={`px-2.5 py-1 rounded-md transition ${
                      statusFilter === "clean"
                        ? "bg-zinc-800 text-zinc-100 font-medium"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Full Headroom ({agents.filter((a) => a.outstandingDebt === 0).length})
                  </button>
                </div>

                {/* Grid / Table toggle */}
                <div className="flex items-center bg-[#111115] p-1 rounded-lg border border-white/[0.06] text-zinc-400">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1 rounded-md transition ${
                      viewMode === "grid" ? "bg-zinc-800 text-zinc-100" : "hover:text-zinc-200"
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`p-1 rounded-md transition ${
                      viewMode === "table" ? "bg-zinc-800 text-zinc-100" : "hover:text-zinc-200"
                    }`}
                    title="Compact Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Agents View (Grid or Table) */}
            {filteredAgents.length === 0 ? (
              <div className="p-12 text-center text-xs font-mono text-zinc-500 border border-dashed border-white/[0.08] rounded-xl">
                No matching agents found.
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAgents.map((agent) => (
                  <AgentCard
                    key={agent.address}
                    agent={agent}
                    onOpenBorrow={(a) => setSelectedBorrowAgent(a)}
                    onOpenRepay={(a) => setSelectedRepayAgent(a)}
                  />
                ))}
              </div>
            ) : (
              /* Compact Sleek Table */
              <div className="sleek-card rounded-xl overflow-hidden text-xs font-mono">
                <div className="grid grid-cols-12 px-4 py-2.5 border-b border-white/[0.06] text-[10px] uppercase text-zinc-500 font-semibold">
                  <div className="col-span-4">Agent</div>
                  <div className="col-span-2 text-right">Limit</div>
                  <div className="col-span-2 text-right">Drawn Debt</div>
                  <div className="col-span-2 text-right">Available</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {filteredAgents.map((agent) => {
                    const available = Math.max(0, agent.creditLimit - agent.outstandingDebt);
                    return (
                      <div
                        key={agent.address}
                        className="grid grid-cols-12 px-4 py-3 items-center hover:bg-zinc-900/40 transition"
                      >
                        <div className="col-span-4">
                          <div className="font-medium text-zinc-200">{agent.name}</div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {agent.address.slice(0, 8)}...{agent.address.slice(-4)}
                          </div>
                        </div>
                        <div className="col-span-2 text-right text-zinc-400 tabular-nums">
                          ${agent.creditLimit.toFixed(2)}
                        </div>
                        <div className="col-span-2 text-right tabular-nums text-zinc-300">
                          ${agent.outstandingDebt.toFixed(2)}
                        </div>
                        <div className="col-span-2 text-right text-emerald-400 tabular-nums">
                          ${available.toFixed(2)}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedBorrowAgent(agent)}
                            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                            title="Draw Credit"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedRepayAgent(agent)}
                            disabled={agent.outstandingDebt <= 0}
                            className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-20 text-zinc-400 hover:text-white transition"
                            title="Repay Debt"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right 1 Col: Live Audit Activity */}
          <div className="space-y-4">
            <ActivityFeed items={activities} />
          </div>
        </div>
      </main>

      {/* Modals */}
      <BorrowModal
        agent={selectedBorrowAgent}
        isOpen={!!selectedBorrowAgent}
        onClose={() => setSelectedBorrowAgent(null)}
        onConfirmBorrow={handleConfirmBorrow}
      />

      <RepayModal
        agent={selectedRepayAgent}
        isOpen={!!selectedRepayAgent}
        onClose={() => setSelectedRepayAgent(null)}
        onConfirmRepay={handleConfirmRepay}
      />

      <AddAgentModal
        isOpen={isAddAgentOpen}
        onClose={() => setIsAddAgentOpen(false)}
        onAgentAdded={handleAgentAdded}
      />

      <ApiModal
        isOpen={isApiDocsOpen}
        onClose={() => setIsApiDocsOpen(false)}
      />
    </div>
  );
}
