"use client";

import React, { useState } from "react";
import { Agent } from "@/types";
import { Copy, Check, Info } from "lucide-react";
import { Label, short, usd } from "./ui";

const COL_NUM = 96;
const COL_ACTIONS = 300;

/** Column headings, printed once above the list. */
export const AgentListHeader: React.FC = () => (
  <div className="hidden lg:flex items-center gap-6 px-4 py-2" style={{ borderBottom: "1px solid var(--hair)" }}>
    <Label className="flex-1">Agent</Label>
    <Label className="text-right" style={{ width: COL_NUM }}>
      Wallet
    </Label>
    <Label className="text-right" style={{ width: COL_NUM }}>
      Owes
    </Label>
    <span style={{ width: COL_ACTIONS }} />
  </div>
);

interface AgentRowProps {
  agent: Agent;
  /** Shared headroom across every agent on this human's facility. */
  facilityAvailable: number;
  onOpenBorrow: (agent: Agent) => void;
  onOpenRepay: (agent: Agent) => void;
  onOpenPay?: (agent: Agent) => void;
  onOpenDetails?: (agent: Agent) => void;
}

/**
 * One agent on the line.
 *
 * Registration, disconnection and on-chain provenance all live behind the
 * details sheet — the row itself only carries the two things an operator does
 * daily, plus the x402 demo.
 */
export const AgentRow: React.FC<AgentRowProps> = ({
  agent,
  facilityAvailable,
  onOpenBorrow,
  onOpenRepay,
  onOpenPay,
  onOpenDetails,
}) => {
  const [copied, setCopied] = useState(false);

  const worldBacked = agent.isWorldBacked || agent.agentBookStatus === "VERIFIED";
  const wallet = parseFloat(agent.gatewayBalanceUSDC ?? String(agent.currentBalance ?? 0)) || 0;

  const copy = () => {
    navigator.clipboard.writeText(agent.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="row-hover hairline flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 px-4 py-4 lg:py-0 lg:h-[72px]">
      <div className="min-w-0 flex-1">
        <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.005em" }}>{agent.name}</div>
        <div className="flex items-center gap-2.5 mt-1">
          <button
            onClick={copy}
            className="mn faint inline-flex items-center gap-1.5 hover:text-[color:var(--ink)] transition-colors"
            style={{ fontSize: 9.5 }}
            title="Copy address"
          >
            <span>{short(agent.address)}</span>
            {copied ? (
              <Check className="w-3 h-3" style={{ color: "var(--sea)" }} />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>

          <span
            className="mn"
            style={{ fontSize: 9, color: worldBacked ? "var(--sea)" : "var(--ink3)" }}
          >
            {worldBacked ? "World-backed" : "Unverified"}
          </span>

          {agent.isAutonomous && (
            <span className="mn" style={{ fontSize: 9, color: "var(--flare)" }}>
              self-signing
            </span>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-8 lg:gap-6">
        <div className="text-right" style={{ width: COL_NUM }}>
          <Label className="lg:hidden mb-1">Wallet</Label>
          <span
            className="mn"
            style={{ fontSize: 13.5, color: wallet > 0 ? "var(--ink)" : "var(--ink3)" }}
          >
            {usd(wallet)}
          </span>
        </div>

        <div className="text-right" style={{ width: COL_NUM }}>
          <Label className="lg:hidden mb-1">Owes</Label>
          <span
            className="mn"
            style={{ fontSize: 13.5, color: agent.outstandingDebt > 0 ? "var(--ink)" : "var(--ink3)" }}
          >
            {usd(agent.outstandingDebt)}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-2 lg:justify-end shrink-0"
        style={{ width: COL_ACTIONS, maxWidth: "100%" }}
      >
        <button
          onClick={() => onOpenBorrow(agent)}
          disabled={facilityAvailable <= 0}
          className="btn btn-strong"
          title={facilityAvailable <= 0 ? "No headroom left on the facility" : "Draw against the facility"}
        >
          Draw
        </button>

        <button
          onClick={() => onOpenRepay(agent)}
          disabled={agent.outstandingDebt <= 0}
          className="btn"
        >
          Settle
        </button>

        {onOpenPay && (
          <button
            onClick={() => onOpenPay(agent)}
            className="btn"
            style={{ borderColor: "var(--flare)", color: "var(--flare)" }}
            title="Pay an x402 resource using the overdraft"
          >
            x402
          </button>
        )}

        {onOpenDetails && (
          <button onClick={() => onOpenDetails(agent)} className="btn btn-icon" title="Agent details">
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
