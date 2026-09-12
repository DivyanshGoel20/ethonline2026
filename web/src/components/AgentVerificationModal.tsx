"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { Agent } from "@/types";
import { Sheet, Kv, Label, short, usd } from "./ui";

const AGENTBOOK = "0xA23aB2712eA7BBa896930544C7d6636a96b944dA";

interface AgentVerificationModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenRegister?: (agent: Agent) => void;
  onRemove?: (agent: Agent) => void;
}

/** Everything about one agent that isn't a daily action. */
export const AgentVerificationModal: React.FC<AgentVerificationModalProps> = ({
  agent,
  isOpen,
  onClose,
  onOpenRegister,
  onRemove,
}) => {
  if (!isOpen || !agent) return null;

  const verified = agent.isWorldBacked || agent.agentBookStatus === "VERIFIED";

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={agent.name}
      subtitle={agent.address}
      footer={
        <>
          {onRemove && (
            <button
              onClick={() => {
                onClose();
                onRemove(agent);
              }}
              className="btn btn-danger mr-auto"
            >
              Disconnect
            </button>
          )}
          {!verified && onOpenRegister && (
            <button
              onClick={() => {
                onClose();
                onOpenRegister(agent);
              }}
              className="btn btn-solid"
            >
              Register with World
            </button>
          )}
          <button onClick={onClose} className="btn">
            Close
          </button>
        </>
      }
    >
      <div className="note" style={{ borderLeftColor: verified ? "var(--sea)" : "var(--ink3)" }}>
        {verified
          ? "Registered in AgentBook on World Chain. A verified human stands behind this wallet."
          : "Not in AgentBook. It can still draw on your line, but nothing on chain ties it to a person."}
      </div>

      <div>
        <Kv k="Owes" v={usd(agent.outstandingDebt)} />
        <Kv k="Sub-limit" v={usd(agent.creditLimit)} />
        <Kv k="Borrowed to date" v={usd(agent.totalBorrowed)} tone="faint" />
        <Kv k="Repaid to date" v={usd(agent.totalRepaid)} tone="faint" />
        <Kv k="Signing" v={agent.isAutonomous ? "self-signing" : "operator-signed"} tone="faint" />
      </div>

      <div>
        <Label className="mb-3">Provenance</Label>
        <Kv
          k="AgentBook registry"
          v={
            <a
              className="link"
              href={`https://worldscan.org/address/${AGENTBOOK}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {short(AGENTBOOK)} <ExternalLink className="w-3 h-3 inline" />
            </a>
          }
        />
        <Kv k="Registry network" v="World Chain (eip155:480)" tone="faint" />
        <Kv
          k="Agent wallet"
          v={
            <a
              className="link"
              href={`https://testnet.arcscan.app/address/${agent.address}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {short(agent.address)} <ExternalLink className="w-3 h-3 inline" />
            </a>
          }
        />
        {agent.agentBookTxHash && (
          <Kv
            k="Registration tx"
            v={
              <a
                className="link"
                href={`https://worldscan.org/tx/${agent.agentBookTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {short(agent.agentBookTxHash)} <ExternalLink className="w-3 h-3 inline" />
              </a>
            }
          />
        )}
      </div>
    </Sheet>
  );
};
