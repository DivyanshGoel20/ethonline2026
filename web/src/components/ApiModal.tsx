"use client";

import React, { useState } from "react";
import { X, Copy, Check, Terminal } from "lucide-react";

interface ApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EndpointKey = "borrow" | "repay" | "balance" | "credit" | "loans";

export const ApiModal: React.FC<ApiModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<EndpointKey>("borrow");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const endpoints: Record<EndpointKey, { title: string; method: string; path: string; snippet: string; description: string }> = {
    borrow: {
      title: "Borrow Credit",
      method: "POST",
      path: "/api/borrow",
      description: "Agent draws USDC credit backed by verified Human Operator collateral on Arc Testnet.",
      snippet: `curl -X POST https://api.float.finance/api/borrow \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentAddress": "0xYOUR_AGENT_WALLET",
    "amount": 20.0,
    "memo": "Data provider query"
  }'`,
    },
    repay: {
      title: "Repay Credit",
      method: "POST",
      path: "/api/repay",
      description: "Repay loan debt. Sibling agents under the same human borrower can repay any loan.",
      snippet: `curl -X POST https://api.float.finance/api/repay \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentAddress": "0xYOUR_AGENT_WALLET",
    "amount": 20.0,
    "targetAgentAddress": "0xSIBLING_AGENT_OR_SELF"
  }'`,
    },
    balance: {
      title: "Check Balance",
      method: "GET",
      path: "/api/agent/balance",
      description: "Query liquid USDC balance and outstanding debt on Arc Testnet.",
      snippet: `curl -X GET "https://api.float.finance/api/agent/balance?agentAddress=0xYOUR_AGENT_WALLET"`,
    },
    credit: {
      title: "Credit Profile",
      method: "GET",
      path: "/api/agent/credit",
      description: "Inspect available headroom, credit limits, and human facility stats.",
      snippet: `curl -X GET "https://api.float.finance/api/agent/credit?agentAddress=0xYOUR_AGENT_WALLET"`,
    },
    loans: {
      title: "Loan Ledger",
      method: "GET",
      path: "/api/agent/loans",
      description: "Fetch active and settled loans for this agent and shared human facility.",
      snippet: `curl -X GET "https://api.float.finance/api/agent/loans?agentAddress=0xYOUR_AGENT_WALLET&includeShared=true"`,
    },
  };

  const activeEndpoint = endpoints[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeEndpoint.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111115] border border-white/[0.08] rounded-xl max-w-xl w-full p-5 shadow-2xl relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-300">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Float Agent Credit API Reference</h2>
              <p className="text-[11px] font-mono text-zinc-500">Arc Testnet (5042002) • Autonomous Credit Facilities</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-white/[0.06] text-xs font-mono">
            {(Object.keys(endpoints) as EndpointKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-2.5 py-1 rounded-md transition text-[11px] ${
                  activeTab === key
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {endpoints[key].method} {key}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy cURL"}</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-400">
          <span className="text-zinc-200 font-medium">{activeEndpoint.title}:</span> {activeEndpoint.description}
        </div>

        {/* Code block */}
        <pre className="p-3.5 rounded-lg bg-zinc-950 border border-white/[0.06] text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {activeEndpoint.snippet}
        </pre>

        {/* Shared Human Borrower Note */}
        <div className="p-3 rounded-lg bg-zinc-900/40 border border-white/[0.04] text-[11px] font-mono text-zinc-400 space-y-1">
          <div className="text-zinc-300 font-medium">Shared Human Borrower Model:</div>
          <div>• Loans are linked to the verified Human Operator collateral pool.</div>
          <div>• Any agent under the human can repay its own loan or sibling agents' debt.</div>
          <div>• Settled autonomously on Arc Testnet with cryptographic audit trails.</div>
        </div>
      </div>
    </div>
  );
};
