"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { CreditStats } from "@/components/CreditStats";
import { AgentCard } from "@/components/AgentCard";
import { BorrowModal } from "@/components/BorrowModal";
import { RepayModal } from "@/components/RepayModal";
import { AddAgentModal } from "@/components/AddAgentModal";
import { RemoveAgentModal } from "@/components/RemoveAgentModal";
import { AgentKitRegisterModal } from "@/components/AgentKitRegisterModal";
import { AgentVerificationModal } from "@/components/AgentVerificationModal";
import { ApiModal } from "@/components/ApiModal";
import { WorldAuthGate } from "@/components/WorldAuthGate";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Agent, CreditStats as CreditStatsType, ActivityItem } from "@/types";
import { Search, Plus, Bot } from "lucide-react";

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "debt" | "clean">("all");

  // World Verification Operator session
  const [isWorldVerified, setIsWorldVerified] = useState(false);
  const [nullifierHash, setNullifierHash] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Modals state
  const [selectedBorrowAgent, setSelectedBorrowAgent] = useState<Agent | null>(null);
  const [selectedRepayAgent, setSelectedRepayAgent] = useState<Agent | null>(null);
  const [selectedRemoveAgent, setSelectedRemoveAgent] = useState<Agent | null>(null);
  const [selectedAgentKitAgent, setSelectedAgentKitAgent] = useState<Agent | null>(null);
  const [selectedDetailsAgent, setSelectedDetailsAgent] = useState<Agent | null>(null);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isApiDocsOpen, setIsApiDocsOpen] = useState(false);

  // Recent Activity Feed
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Toast feedback
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

    // Fetch real agents from store
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (data.agents && Array.isArray(data.agents)) {
          setAgents(data.agents);
        }
      })
      .catch((err) => console.error("[Dashboard] Error fetching agents:", err));
  }, []);

  // Shared aggregate credit calculation (Human-level facility of $500)
  const totalAvailableCredit = Math.max(
    0,
    500 - agents.reduce((acc, a) => acc + a.outstandingDebt, 0)
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
    const res = await fetch("/api/borrow", {
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
              outstandingDebt: data.newOutstandingDebt ?? a.outstandingDebt + amount,
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
    const res = await fetch("/api/repay", {
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

    // Refresh agent states from server
    fetch("/api/agents")
      .then((r) => r.json())
      .then((agentData) => {
        if (agentData.agents && Array.isArray(agentData.agents)) {
          setAgents(agentData.agents);
        }
      })
      .catch((e) => console.error("Error refreshing agents:", e));

    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        type: "repay",
        agentName: targetAgent?.name || "Agent",
        agentAddress,
        amount: data.amount || amount,
        timestamp: Date.now(),
        txHash: data.txHash || "0xarc_repay",
      },
      ...prev,
    ]);

    showToast(`Settled $${amount.toFixed(2)} USDC repayment for ${targetAgent?.name || "Agent"}`);
  };

  // Handle Agent Added
  const handleAgentAdded = (newAgent: Agent) => {
    setAgents((prev) => {
      const exists = prev.some((a) => a.address.toLowerCase() === newAgent.address.toLowerCase());
      if (exists) {
        return prev.map((a) =>
          a.address.toLowerCase() === newAgent.address.toLowerCase() ? newAgent : a
        );
      }
      return [newAgent, ...prev];
    });

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

    showToast(`Added ${newAgent.name} to Arc credit facility`);
  };

  // Handle Agent Removed / Disconnected
  const handleConfirmRemove = async (agentAddress: string) => {
    const res = await fetch(`/api/agents?address=${encodeURIComponent(agentAddress)}`, {
      method: "DELETE",
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to disconnect agent");
    }

    const targetAgent = agents.find(
      (a) => a.address.toLowerCase() === agentAddress.toLowerCase()
    );

    setAgents((prev) =>
      prev.filter((a) => a.address.toLowerCase() !== agentAddress.toLowerCase())
    );

    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        type: "remove",
        agentName: targetAgent?.name || "Agent",
        agentAddress,
        timestamp: Date.now(),
        txHash: "0xarc_disconnect",
      },
      ...prev,
    ]);

    showToast(`Disconnected ${targetAgent?.name || "Agent"} from facility`);
  };

  // Handle World Verification Passed
  const handleWorldVerified = (hash: string) => {
    localStorage.setItem("float_world_session", hash);
    setIsWorldVerified(true);
    setNullifierHash(hash);
    showToast("Human operator verified via World Selfie Check");
  };

  // Handle Sign Out
  const handleSignOut = () => {
    localStorage.removeItem("float_world_session");
    setIsWorldVerified(false);
    setNullifierHash(null);
    showToast("Signed out of World ID session", "neutral");
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060709] text-zinc-500 font-mono text-xs">
        Checking verification session...
      </div>
    );
  }

  // 1. GATEKEEPER: World Selfie Check authentication
  if (!isWorldVerified) {
    return <WorldAuthGate onVerified={handleWorldVerified} />;
  }

  // 2. MAIN REDESIGNED DASHBOARD
  return (
    <div className="min-h-screen flex flex-col bg-[#060709] text-zinc-100 bg-grid-pattern">
      <Header
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
        onOpenApiDocs={() => setIsApiDocsOpen(true)}
        onSignOut={handleSignOut}
        isWorldVerified={isWorldVerified}
        nullifierHash={nullifierHash}
        activeAgentsCount={agents.length}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 py-2 px-4 rounded-xl bg-[#14171f] border border-white/[0.1] text-zinc-200 text-xs shadow-2xl flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{toast.message}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10">
        {/* Institutional Hero Credit Facility Section */}
        <section>
          <CreditStats stats={stats} />
        </section>

        {/* Section: My Agents Header */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white font-sans">
                My Agents
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-white/[0.08] text-xs text-zinc-400 font-mono">
                {agents.length}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Human-backed agents on Arc
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search Filter */}
            {agents.length > 0 && (
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900/80 border border-white/[0.08] text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition"
                />
              </div>
            )}

            <button
              onClick={() => setIsAddAgentOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-sm transition active:scale-[0.98] shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-950" />
              <span>Add Agent</span>
            </button>
          </div>
        </section>

        {/* Main Workspace Layout (Agents Grid + Activity Rail) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Agents Grid */}
          <div className="lg:col-span-8 space-y-4">
            {agents.length === 0 ? (
              /* High-End Clean Empty State */
              <div className="fintech-card p-12 text-center rounded-2xl space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400">
                  <Bot className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">No agents added</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1.5 leading-relaxed">
                    Add an Arc Testnet agent wallet to begin extending credit and linking to canonical World AgentBook.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setIsAddAgentOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition shadow-sm"
                  >
                    + Add Existing Agent
                  </button>
                </div>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="fintech-card p-12 text-center text-xs text-zinc-500 rounded-2xl">
                No agents match your search filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAgents.map((agent) => (
                  <AgentCard
                    key={agent.address}
                    agent={agent}
                    onOpenBorrow={(a) => setSelectedBorrowAgent(a)}
                    onOpenRepay={(a) => setSelectedRepayAgent(a)}
                    onRemoveAgent={(a) => setSelectedRemoveAgent(a)}
                    onOpenAgentKitRegister={(a) => setSelectedAgentKitAgent(a)}
                    onOpenDetails={(a) => setSelectedDetailsAgent(a)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Activity Rail */}
          <div className="lg:col-span-4 space-y-4">
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
        humanOwner={nullifierHash}
      />

      <RemoveAgentModal
        agent={selectedRemoveAgent}
        isOpen={!!selectedRemoveAgent}
        onClose={() => setSelectedRemoveAgent(null)}
        onConfirmRemove={handleConfirmRemove}
      />

      <AgentKitRegisterModal
        agent={selectedAgentKitAgent}
        isOpen={!!selectedAgentKitAgent}
        onClose={() => setSelectedAgentKitAgent(null)}
        onVerified={(updated) => {
          setAgents((prev) =>
            prev.map((a) =>
              a.address.toLowerCase() === updated.address.toLowerCase()
                ? { ...a, ...updated }
                : a
            )
          );
          showToast(`${updated.name} verified as World-backed`);
        }}
      />

      <AgentVerificationModal
        agent={selectedDetailsAgent}
        isOpen={!!selectedDetailsAgent}
        onClose={() => setSelectedDetailsAgent(null)}
        onOpenRegister={(a) => setSelectedAgentKitAgent(a)}
      />

      <ApiModal
        isOpen={isApiDocsOpen}
        onClose={() => setIsApiDocsOpen(false)}
      />
    </div>
  );
}
