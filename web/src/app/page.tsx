"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { CreditStats } from "@/components/CreditStats";
import { AgentCard } from "@/components/AgentCard";
import { AddAgentModal } from "@/components/AddAgentModal";
import { WorldVerifyModal } from "@/components/WorldVerifyModal";
import { AgentApiInstructions } from "@/components/AgentApiInstructions";
import { Agent, CreditStats as CreditStatsType } from "@/types";
import { ShieldCheck, Plus, Sparkles, Database, Layers, ArrowUpRight } from "lucide-react";

export default function Home() {
  const [isWorldVerified, setIsWorldVerified] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isWorldModalOpen, setIsWorldModalOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial agents
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (data.agents) setAgents(data.agents);
      })
      .catch((err) => console.error(err));
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Aggregate stats
  const totalAvailableCredit = agents.reduce((acc, a) => acc + Math.max(0, a.creditLimit - a.outstandingDebt), 0);
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

  const handleSimulateBorrow = async (agent: Agent) => {
    const amountToBorrow = 20;
    try {
      const res = await fetch("/api/agent/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentAddress: agent.address,
          amount: amountToBorrow,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAgents((prev) =>
          prev.map((a) =>
            a.address.toLowerCase() === agent.address.toLowerCase()
              ? {
                  ...a,
                  outstandingDebt: a.outstandingDebt + amountToBorrow,
                  totalBorrowed: a.totalBorrowed + amountToBorrow,
                  currentBalance: a.currentBalance + amountToBorrow,
                }
              : a
          )
        );
        showToast(`⚡ Borrowed $${amountToBorrow} USDC for ${agent.name} on Arc!`);
      } else {
        showToast(`❌ Borrow error: ${data.error}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleSimulateRepay = async (agent: Agent) => {
    const amountToRepay = Math.min(agent.outstandingDebt, 20);
    if (amountToRepay <= 0) return;

    try {
      const res = await fetch("/api/agent/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentAddress: agent.address,
          amount: amountToRepay,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAgents((prev) =>
          prev.map((a) =>
            a.address.toLowerCase() === agent.address.toLowerCase()
              ? {
                  ...a,
                  outstandingDebt: Math.max(0, a.outstandingDebt - amountToRepay),
                  totalRepaid: a.totalRepaid + amountToRepay,
                }
              : a
          )
        );
        showToast(`✅ Repaid $${amountToRepay} USDC debt for ${agent.name}!`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleAgentAdded = (newAgent: Agent) => {
    setAgents((prev) => [newAgent, ...prev]);
    showToast(`🤖 Registered agent "${newAgent.name}" with $${newAgent.creditLimit} USDC credit facility!`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        isWorldVerified={isWorldVerified}
        onOpenWorldVerify={() => setIsWorldModalOpen(true)}
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
      />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 py-2.5 px-4 rounded-xl bg-teal-950 border border-teal-500/40 text-teal-200 text-xs shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>{notification}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Verification Callout if unverified */}
        {!isWorldVerified && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-slate-900/80 border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Human Account Verification Required</h3>
                <p className="text-xs text-slate-400">
                  Complete World Selfie Check to establish human continuity and unlock authorized agent credit management.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsWorldModalOpen(true)}
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition whitespace-nowrap"
            >
              Verify with World Selfie Check
            </button>
          </div>
        )}

        {/* Global Financial Metrics */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Credit Portfolio</h2>
            <span className="text-xs text-slate-500 font-mono">Settlement: Arc Testnet</span>
          </div>
          <CreditStats stats={stats} />
        </section>

        {/* Agent Cards Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Your AI Agents</h2>
              <p className="text-xs text-slate-400">Active autonomous agents with configured credit lines</p>
            </div>

            <button
              onClick={() => setIsAddAgentOpen(true)}
              className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5 text-teal-400" />
              <span>Add Agent</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents.map((agent) => (
              <AgentCard
                key={agent.address}
                agent={agent}
                onSimulateBorrow={handleSimulateBorrow}
                onSimulateRepay={handleSimulateRepay}
              />
            ))}
          </div>
        </section>

        {/* Integration Instructions */}
        <section>
          <AgentApiInstructions />
        </section>

        {/* Sponsor Badges / Proof Layer */}
        <section className="p-5 rounded-2xl bg-slate-950/40 border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">World Selfie Check</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Biometric liveness verification establishing human operator custody.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">Arc & Circle Nanopayments</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Stablecoin-native settlement and gas-free x402 nanopayments on Arc.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">The Graph Protocol</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Standardized agent financial profiling and composable event indexing.
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modals */}
      <AddAgentModal
        isOpen={isAddAgentOpen}
        onClose={() => setIsAddAgentOpen(false)}
        onAgentAdded={handleAgentAdded}
      />

      <WorldVerifyModal
        isOpen={isWorldModalOpen}
        onClose={() => setIsWorldModalOpen(false)}
        onVerified={() => {
          setIsWorldVerified(true);
          showToast("🎉 Verified with World Selfie Check!");
        }}
      />
    </div>
  );
}
