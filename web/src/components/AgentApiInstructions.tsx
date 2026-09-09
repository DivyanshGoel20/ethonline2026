"use client";

import React, { useState } from "react";
import { Terminal, Copy, Check } from "lucide-react";

export const AgentApiInstructions: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const instructionsText = `### Float AI Agent Credit Protocol Configuration

Borrow Liquidity:
POST https://float-arc.app/api/agent/borrow
Headers: { "Content-Type": "application/json" }
Body: { "agentAddress": "0xYOUR_AGENT_WALLET", "amount": "20.00" }

Repay Debt:
POST https://float-arc.app/api/agent/repay
Headers: { "Content-Type": "application/json" }
Body: { "agentAddress": "0xYOUR_AGENT_WALLET", "amount": "20.00" }

Agent Execution Rule:
1. Before making an onchain or x402 payment, inspect available liquid balance.
2. If balance is insufficient, call Float Borrow API within approved credit limit.
3. Settle transaction using Arc Nanopayments.
4. When job revenue is received, call Float Repay API to restore available credit.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(instructionsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-teal-400" />
          <h4 className="text-sm font-semibold text-white">Agent Integration Instruction Block</h4>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied" : "Copy Configuration"}</span>
        </button>
      </div>

      <pre className="p-3.5 rounded-xl bg-slate-950 border border-white/5 font-mono text-xs text-teal-300/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {instructionsText}
      </pre>
    </div>
  );
};
