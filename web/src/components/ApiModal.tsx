"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Sheet, Label } from "./ui";

interface ApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Key = "borrow" | "repay" | "balance" | "credit" | "loans";

const ENDPOINTS: Record<Key, { method: string; blurb: string; snippet: string }> = {
  borrow: {
    method: "POST",
    blurb: "Draw USDC against the human facility. Fails closed if the line has no headroom.",
    snippet: `curl -X POST https://api.float.finance/api/borrow \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentAddress": "0xYOUR_AGENT_WALLET",
    "amount": 0.5,
    "memo": "data provider query"
  }'`,
  },
  repay: {
    method: "POST",
    blurb: "Settle debt. Any agent on the facility can clear a sibling's balance.",
    snippet: `curl -X POST https://api.float.finance/api/repay \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentAddress": "0xYOUR_AGENT_WALLET",
    "amount": 0.5,
    "targetAgentAddress": "0xSIBLING_OR_SELF"
  }'`,
  },
  balance: {
    method: "GET",
    blurb: "Liquid USDC and outstanding debt for one agent.",
    snippet: `curl "https://api.float.finance/api/agent/balance?agentAddress=0xYOUR_AGENT_WALLET"`,
  },
  credit: {
    method: "GET",
    blurb: "Headroom, sub-limit and the human facility's current state.",
    snippet: `curl "https://api.float.finance/api/agent/credit?agentAddress=0xYOUR_AGENT_WALLET"`,
  },
  loans: {
    method: "GET",
    blurb: "Open and settled tranches for this agent and its siblings.",
    snippet: `curl "https://api.float.finance/api/agent/loans?agentAddress=0xYOUR_AGENT_WALLET&includeShared=true"`,
  },
};

export const ApiModal: React.FC<ApiModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<Key>("borrow");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const active = ENDPOINTS[tab];

  const copy = () => {
    navigator.clipboard.writeText(active.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Agent API"
      subtitle="Arc testnet · chain 5042002"
      width={640}
      footer={
        <button onClick={onClose} className="btn">
          Close
        </button>
      }
    >
      <div className="flex gap-2">
        {(Object.keys(ENDPOINTS) as Key[]).map((key) => (
          <button key={key} onClick={() => setTab(key)} className="tab" data-on={tab === key}>
            {key}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-4 mb-2.5">
          <Label>
            {active.method} /api/{tab === "borrow" || tab === "repay" ? tab : `agent/${tab}`}
          </Label>
          <button onClick={copy} className="btn" style={{ height: 24, fontSize: 8.5 }}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="dim mb-3" style={{ fontSize: 13 }}>
          {active.blurb}
        </p>
        <pre className="code">{active.snippet}</pre>
      </div>

      <div className="note">
        Loans belong to the human, not the agent. Any agent the human authorised can draw on the same
        pool, and any of them can settle another&rsquo;s balance.
      </div>
    </Sheet>
  );
};
