"use client";

import React, { useState } from "react";
import { Agent } from "@/types";
import { Sheet, Field, ErrorNote } from "./ui";

const PRECONFIGURED = "0xa5509d881a4632591117bcb7145ec9e80c015dc3";

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentAdded: (agent: Agent) => void;
}

export const AddAgentModal: React.FC<AddAgentModalProps> = ({
  isOpen,
  onClose,
  onAgentAdded,
}) => {
  const [name, setName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const known = walletAddress.trim().toLowerCase() === PRECONFIGURED;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const address = walletAddress.trim();
    const label = name.trim();

    if (!label) return setError("Give the agent a name.");
    if (!address) return setError("Paste the agent's Arc wallet address.");

    setBusy(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No humanOwner: the server reads it from the World session. Sending it
        // is what let anyone register an agent against someone else's credit.
        body: JSON.stringify({
          action: "add",
          name: label,
          walletAddress: address,
          privateKey: privateKey.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        throw new Error("Your World session expired. Verify again to add an agent.");
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || "That is not a usable Arc testnet agent wallet.");
      }

      onAgentAdded(data.agent);
      setName("");
      setWalletAddress("");
      setPrivateKey("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Could not add the agent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Put an agent on the line"
      subtitle="Arc testnet · chain 5042002"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn">
            Cancel
          </button>
          <button type="submit" form="add-agent-form" disabled={busy} className="btn btn-solid">
            {busy ? "Checking…" : "Add agent"}
          </button>
        </>
      }
    >
      <form id="add-agent-form" onSubmit={submit} className="space-y-5">
        <Field label="Name">
          <input
            type="text"
            placeholder="Scout"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="field"
          />
        </Field>

        <Field
          label="Agent wallet"
          hint={known ? "Signing key already in the keystore." : "An active EVM address on Arc testnet."}
        >
          <input
            type="text"
            placeholder="0xA5509d881A4632591117bCB7145EC9e80C015DC3"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="field"
            style={{ fontSize: 12 }}
          />
        </Field>

        <Field
          label="Signing key (optional)"
          hint={
            <>
              Lets the agent pay its own x402 charges and settle from its own wallet. Must be the
              key for the address above &mdash; a key for any other wallet is refused. Stored
              encrypted, capped at $5.00 a payment, and expires in 30 days.
              <br />
              Leave it blank and Float signs instead; the agent still draws on your line.
            </>
          }
        >
          <input
            type="password"
            placeholder={known ? "•".repeat(32) : "0x…"}
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            className="field"
            style={{ fontSize: 12 }}
          />
        </Field>
      </form>

      <div className="note">
        The agent draws against <em>your</em> line, not its own. You stay liable for what it spends.
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
    </Sheet>
  );
};
