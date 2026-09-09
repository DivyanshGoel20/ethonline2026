"use client";

import React, { useState } from "react";
import { X, Copy, Check, Terminal } from "lucide-react";

interface ApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiModal: React.FC<ApiModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"borrow" | "repay">("borrow");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const borrowSnippet = `curl -X POST https://api.float.finance/api/agent/borrow \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentAddress": "0xYOUR_AGENT_WALLET",
    "amount": "20.00"
  }'`;

  const repaySnippet = `curl -X POST https://api.float.finance/api/agent/repay \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentAddress": "0xYOUR_AGENT_WALLET",
    "amount": "20.00"
  }'`;

  const snippetToCopy = activeTab === "borrow" ? borrowSnippet : repaySnippet;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippetToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111115] border border-white/[0.08] rounded-xl max-w-lg w-full p-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-300">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Agent Credit API Reference</h2>
              <p className="text-[11px] font-mono text-zinc-500">Autonomous execution endpoints</p>
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
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-white/[0.06] text-xs font-mono">
            <button
              onClick={() => setActiveTab("borrow")}
              className={`px-3 py-1 rounded-md transition ${
                activeTab === "borrow" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              POST /borrow
            </button>
            <button
              onClick={() => setActiveTab("repay")}
              className={`px-3 py-1 rounded-md transition ${
                activeTab === "repay" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              POST /repay
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy cURL"}</span>
          </button>
        </div>

        {/* Code block */}
        <pre className="mt-3 p-3.5 rounded-lg bg-zinc-950 border border-white/[0.06] text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {snippetToCopy}
        </pre>

        {/* Guidance */}
        <div className="mt-4 p-3 rounded-lg bg-zinc-900/40 border border-white/[0.04] text-[11px] font-mono text-zinc-400 space-y-1">
          <div className="text-zinc-300 font-medium">Integration Rule:</div>
          <div>1. When agent hits insufficient liquidity for x402 payment, call /borrow.</div>
          <div>2. Float evaluates headroom and transfers USDC to agent wallet.</div>
          <div>3. When task revenue is collected, call /repay to restore credit limit.</div>
        </div>
      </div>
    </div>
  );
};
