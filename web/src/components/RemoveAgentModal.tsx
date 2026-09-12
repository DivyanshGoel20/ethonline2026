"use client";

import React, { useState } from "react";
import { Agent } from "@/types";
import { Sheet, ErrorNote, usd, short } from "./ui";

interface RemoveAgentModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmRemove: (agentAddress: string) => Promise<void>;
}

export const RemoveAgentModal: React.FC<RemoveAgentModalProps> = ({
  agent,
  isOpen,
  onClose,
  onConfirmRemove,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !agent) return null;

  const owes = agent.outstandingDebt > 0;

  const confirm = async () => {
    if (owes) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirmRemove(agent.address);
      onClose();
    } catch (err: any) {
      setError(err.message || "Could not disconnect the agent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Take it off the line"
      subtitle={`${agent.name} · ${short(agent.address)}`}
      width={460}
      footer={
        owes ? (
          <button onClick={onClose} className="btn btn-strong">
            Understood
          </button>
        ) : (
          <>
            <button onClick={onClose} disabled={busy} className="btn">
              Cancel
            </button>
            <button onClick={confirm} disabled={busy} className="btn btn-danger">
              {busy ? "Disconnecting…" : "Disconnect"}
            </button>
          </>
        )
      }
    >
      {owes ? (
        <div className="note note-warn" style={{ color: "var(--ink2)" }}>
          {agent.name} still owes <strong>{usd(agent.outstandingDebt)}</strong>. Settle that first
          &mdash; an agent cannot walk away from a balance that sits on you.
        </div>
      ) : (
        <p className="dim" style={{ fontSize: 14, lineHeight: 1.6 }}>
          {agent.name} loses authorisation to draw against your facility. Its history stays on chain.
        </p>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
    </Sheet>
  );
};
