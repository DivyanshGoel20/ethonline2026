"use client";

import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";

import { Header } from "@/components/Header";
import { CreditStats } from "@/components/CreditStats";
import { AgentRow, AgentListHeader } from "@/components/AgentRow";
import { BorrowModal } from "@/components/BorrowModal";
import { RepayModal } from "@/components/RepayModal";
import { AddAgentModal } from "@/components/AddAgentModal";
import { RemoveAgentModal } from "@/components/RemoveAgentModal";
import { AgentKitRegisterModal } from "@/components/AgentKitRegisterModal";
import { AgentVerificationModal } from "@/components/AgentVerificationModal";
import { X402PayModal } from "@/components/X402PayModal";
import { ApiModal } from "@/components/ApiModal";
import { WorldAuthGate } from "@/components/WorldAuthGate";
import { SmartContractTelemetry } from "@/components/SmartContractTelemetry";
import { LiveTransactionFeed } from "@/components/LiveTransactionFeed";
import { ReputationTierCard } from "@/components/ReputationTierCard";
import { Label, usd } from "@/components/ui";
import { Agent, CreditStats as CreditStatsType } from "@/types";

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [query, setQuery] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [facilityLimit, setFacilityLimit] = useState(10);

  const [isWorldVerified, setIsWorldVerified] = useState(false);
  const [nullifierHash, setNullifierHash] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [borrowAgent, setBorrowAgent] = useState<Agent | null>(null);
  const [repayAgent, setRepayAgent] = useState<Agent | null>(null);
  const [removeAgent, setRemoveAgent] = useState<Agent | null>(null);
  const [registerAgent, setRegisterAgent] = useState<Agent | null>(null);
  const [detailsAgent, setDetailsAgent] = useState<Agent | null>(null);
  const [payAgent, setPayAgent] = useState<Agent | null>(null);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isApiDocsOpen, setIsApiDocsOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  };

  /** Back to the gate: the cookie expired, was voided, or never existed. */
  const endSession = () => {
    setIsWorldVerified(false);
    setNullifierHash(null);
    setAgents([]);
  };

  const loadAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.status === 401) return endSession();
      const data = await res.json();
      if (Array.isArray(data.agents)) setAgents(data.agents);
    } catch (err) {
      console.error("[Dashboard] Could not load agents:", err);
    }
  };

  /**
   * POST through the session.
   *
   * Every spending route is gated on the World cookie now, so a dead session
   * has to put the operator back in front of the gate rather than surfacing a
   * raw 401 inside a modal.
   */
  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      endSession();
      throw new Error("Your World session expired. Verify again to keep spending.");
    }
    if (!res.ok || !data.success) throw new Error(data.error || "That did not settle.");
    return data;
  };

  // The session cookie is httpOnly, so who we are is a question for the server.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const { human } = await res.json();
          setIsWorldVerified(true);
          setNullifierHash(human);
          // Deliberately not awaited. Whether to show the gate is already
          // decided; holding the whole app on a spinner because an RPC behind
          // /api/agents is rate-limited is a bad trade.
          void loadAgents();
        }
      } catch {
        /* no session: the gate takes it from here */
      } finally {
        setIsLoadingSession(false);
      }
    })();
  }, []);

  const drawn = agents.reduce((n, a) => n + a.outstandingDebt, 0);
  const available = Math.max(0, facilityLimit - drawn);

  const stats: CreditStatsType = {
    totalAvailableCredit: available,
    totalCreditUsed: drawn,
    totalOutstandingDebt: drawn,
    totalBorrowed: agents.reduce((n, a) => n + a.totalBorrowed, 0),
    totalRepaid: agents.reduce((n, a) => n + a.totalRepaid, 0),
    activeAgentsCount: agents.length,
  };

  const visible = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.address.toLowerCase().includes(query.toLowerCase())
  );

  const handleConfirmBorrow = async (agentAddress: string, amount: number) => {
    const data = await post("/api/borrow", { agentAddress, amount });

    const target = agents.find((a) => a.address.toLowerCase() === agentAddress.toLowerCase());

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

    setRefreshTrigger((t) => t + 1);
    showToast(`${target?.name ?? "Agent"} drew ${usd(amount)} against the facility`);
  };

  const handleConfirmRepay = async (agentAddress: string, amount: number, txHash?: string) => {
    await post("/api/repay", { agentAddress, amount, txHash });

    const target = agents.find((a) => a.address.toLowerCase() === agentAddress.toLowerCase());
    await loadAgents();

    setRefreshTrigger((t) => t + 1);
    showToast(`${target?.name ?? "Agent"} settled ${usd(amount)}`);
  };

  const handleAgentAdded = (agent: Agent) => {
    setAgents((prev) => {
      const exists = prev.some((a) => a.address.toLowerCase() === agent.address.toLowerCase());
      return exists
        ? prev.map((a) => (a.address.toLowerCase() === agent.address.toLowerCase() ? agent : a))
        : [agent, ...prev];
    });
    setRefreshTrigger((t) => t + 1);
    showToast(`${agent.name} is on the line`);
  };

  const handleConfirmRemove = async (agentAddress: string) => {
    const res = await fetch(`/api/agents?address=${encodeURIComponent(agentAddress)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      endSession();
      throw new Error("Your World session expired. Verify again to manage agents.");
    }
    if (!res.ok || !data.success) throw new Error(data.error || "Could not disconnect the agent");

    const target = agents.find((a) => a.address.toLowerCase() === agentAddress.toLowerCase());
    setAgents((prev) => prev.filter((a) => a.address.toLowerCase() !== agentAddress.toLowerCase()));
    setRefreshTrigger((t) => t + 1);
    showToast(`${target?.name ?? "Agent"} disconnected`);
  };

  const handleWorldVerified = (hash: string) => {
    // The verify route already minted the cookie; this is the UI catching up.
    setIsWorldVerified(true);
    setNullifierHash(hash);
    loadAgents();
    showToast("Human verified via World Selfie Check");
  };

  const handleSignOut = async () => {
    // Forgetting the nullifier client-side is not signing out - the cookie is
    // what authorises spending, so the server has to void it.
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      /* clear the UI either way */
    }
    endSession();
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="mn faint" style={{ fontSize: 10 }}>
          checking session&hellip;
        </span>
      </div>
    );
  }

  if (!isWorldVerified) return <WorldAuthGate onVerified={handleWorldVerified} />;

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
        onOpenApiDocs={() => setIsApiDocsOpen(true)}
        onSignOut={handleSignOut}
        isWorldVerified={isWorldVerified}
        nullifierHash={nullifierHash}
        activeAgentsCount={agents.length}
      />

      {toast && (
        <div
          className="fixed bottom-7 right-7 z-50 px-4 py-3 flex items-center gap-3"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--ink)",
            boxShadow: "8px 8px 0 rgba(23,21,15,0.14)",
          }}
        >
          <span style={{ width: 6, height: 6, background: "var(--sea)" }} />
          <span style={{ fontSize: 13 }}>{toast}</span>
        </div>
      )}

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 sm:px-10 py-10 sm:py-12 space-y-12">
        <CreditStats stats={stats} facilityLimit={facilityLimit} />

        <ReputationTierCard
          humanOwner={nullifierHash || ""}
          refreshTrigger={refreshTrigger}
          onTier={setFacilityLimit}
        />

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-4 mb-3">
            <div className="flex items-baseline gap-3">
              <span className="serif" style={{ fontSize: 26 }}>
                Agents
              </span>
              <span className="mn faint" style={{ fontSize: 9.5 }}>
                {agents.length} on this line
              </span>
            </div>

            {agents.length > 4 && (
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--ink3)" }}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="filter"
                  className="field"
                  style={{ height: 32, width: 200, paddingLeft: 32, fontSize: 12 }}
                />
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--ink)" }}>
            {agents.length === 0 ? (
              <div className="py-12 text-center">
                <p className="dim mx-auto" style={{ fontSize: 14, maxWidth: "44ch", lineHeight: 1.6 }}>
                  No agents yet. Add an Arc wallet and it can start drawing against your line
                  immediately &mdash; up to {usd(facilityLimit)}.
                </p>
                <button onClick={() => setIsAddAgentOpen(true)} className="btn btn-solid mt-6">
                  Add your first agent
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="py-10 dim" style={{ fontSize: 13 }}>
                Nothing matches that filter.
              </div>
            ) : (
              <>
                <AgentListHeader />
                {visible.map((agent) => (
                  <AgentRow
                    key={agent.address}
                    agent={agent}
                    facilityAvailable={available}
                    onOpenBorrow={setBorrowAgent}
                    onOpenRepay={setRepayAgent}
                    onOpenPay={setPayAgent}
                    onOpenDetails={setDetailsAgent}
                  />
                ))}
              </>
            )}
          </div>
        </section>

        <LiveTransactionFeed humanOwner={nullifierHash} refreshTrigger={refreshTrigger} />

        <SmartContractTelemetry humanOwner={nullifierHash} refreshTrigger={refreshTrigger} />

        <footer className="pt-4">
          <Label>Float &middot; credit for machines that spend</Label>
        </footer>
      </main>

      <BorrowModal
        agent={borrowAgent}
        isOpen={!!borrowAgent}
        onClose={() => setBorrowAgent(null)}
        onConfirmBorrow={handleConfirmBorrow}
        maxFacilityCredit={available}
      />

      <RepayModal
        agent={repayAgent}
        isOpen={!!repayAgent}
        onClose={() => setRepayAgent(null)}
        onConfirmRepay={handleConfirmRepay}
      />

      <AddAgentModal
        isOpen={isAddAgentOpen}
        onClose={() => setIsAddAgentOpen(false)}
        onAgentAdded={handleAgentAdded}
      />

      <RemoveAgentModal
        agent={removeAgent}
        isOpen={!!removeAgent}
        onClose={() => setRemoveAgent(null)}
        onConfirmRemove={handleConfirmRemove}
      />

      <AgentKitRegisterModal
        agent={registerAgent}
        isOpen={!!registerAgent}
        onClose={() => setRegisterAgent(null)}
        onVerified={(updated) => {
          setAgents((prev) =>
            prev.map((a) =>
              a.address.toLowerCase() === updated.address.toLowerCase() ? { ...a, ...updated } : a
            )
          );
          showToast(`${updated.name} is World-backed`);
        }}
      />

      <AgentVerificationModal
        agent={detailsAgent}
        isOpen={!!detailsAgent}
        onClose={() => setDetailsAgent(null)}
        onOpenRegister={(a) => setRegisterAgent(a)}
        onRemove={(a) => setRemoveAgent(a)}
      />

      <X402PayModal
        agent={payAgent}
        isOpen={!!payAgent}
        onClose={() => setPayAgent(null)}
        facilityAvailable={available}
        onPaymentSuccess={(result) => {
          const borrowed = parseFloat(result.borrowed || "0.01");
          setAgents((prev) =>
            prev.map((a) =>
              payAgent && a.address.toLowerCase() === payAgent.address.toLowerCase()
                ? {
                    ...a,
                    outstandingDebt: a.outstandingDebt + borrowed,
                    totalBorrowed: a.totalBorrowed + borrowed,
                  }
                : a
            )
          );
          setRefreshTrigger((t) => t + 1);
          showToast(`x402 challenge settled on the overdraft (${usd(borrowed)})`);
        }}
      />

      <ApiModal isOpen={isApiDocsOpen} onClose={() => setIsApiDocsOpen(false)} />
    </div>
  );
}
