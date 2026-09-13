"use client";

import React, { useState, useEffect } from "react";
import { Agent } from "@/types";
import { parseUnits } from "viem";
import { Sheet, Field, Kv, Label, ErrorNote, usd, short } from "./ui";
import { ensureArcNetwork, ARC_TREASURY } from "@/lib/browserChain";
import { useWallet } from "@/lib/useWallet";

interface RepayModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmRepay: (agentAddress: string, amount: number, txHash?: string) => Promise<void>;
}

export const RepayModal: React.FC<RepayModalProps> = ({
  agent,
  isOpen,
  onClose,
  onConfirmRepay,
}) => {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wallet = useWallet();

  /**
   * Spend from the person's own wallet only when they have connected one.
   *
   * This used to read `!!window.ethereum` - having the extension installed was
   * taken as agreement to be billed by it, with nothing on screen saying so.
   * A connection is a decision someone made in the header; an installed
   * extension is not.
   */
  const useBrowserWallet = Boolean(wallet.address) && !agent?.isAutonomous;

  useEffect(() => {
    if (isOpen && agent) {
      setAmount(agent.outstandingDebt.toFixed(2));
      setError(null);
    }
  }, [isOpen, agent]);

  if (!isOpen || !agent) return null;

  const value = parseFloat(amount) || 0;
  const overDebt = value > agent.outstandingDebt + 0.005;
  const remaining = Math.max(0, Math.round((agent.outstandingDebt - value) * 100) / 100);

  // Origination was folded into the debt at draw time, so back it out for display.
  const feePart = Math.round(value * (0.01 / 1.01) * 1000) / 1000;
  const principalPart = Math.max(0, Math.round((value - feePart) * 1000) / 1000);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (value <= 0) return setError("Enter an amount above zero.");
    if (overDebt) return setError(`${agent.name} only owes ${usd(agent.outstandingDebt)}.`);

    setBusy(true);
    setError(null);

    try {
      let txHash: string | undefined;

      if (useBrowserWallet && typeof window !== "undefined" && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;
        const [from] = await ethereum.request({ method: "eth_requestAccounts" });

        // Before sending, not after. A wallet signs on whatever chain it is
        // showing, and Float's treasury address exists on every EVM chain, so
        // a repayment made from Base left real funds somewhere nothing here
        // watches and still came back with a hash to record.
        await ensureArcNetwork(ethereum);

        txHash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from,
              to: ARC_TREASURY,
              // Native, at 18 decimals: on Arc, USDC is the chain's own
              // currency rather than a token contract.
              value: "0x" + parseUnits(value.toFixed(6), 18).toString(16),
            },
          ],
        });

        if (!txHash) throw new Error("The wallet returned no transaction hash; nothing was sent.");
      }

      await onConfirmRepay(agent.address, Math.min(value, agent.outstandingDebt), txHash);
      onClose();
    } catch (err: any) {
      console.error("[RepayModal] Submission error:", err);
      setError(err.shortMessage || err.message || "The repayment did not settle.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Settle"
      subtitle={`${agent.name} · ${short(agent.address)}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn">
            Cancel
          </button>
          <button
            type="submit"
            form="repay-form"
            disabled={busy || value <= 0 || overDebt}
            className="btn btn-solid"
          >
            {busy ? "Settling on Arc…" : useBrowserWallet ? "Pay from my wallet" : "Confirm repayment"}
          </button>
        </>
      }
    >
      <div
        className="mn faint mb-3 px-3 py-2"
        style={{ fontSize: 10, border: "1px solid var(--hair)" }}
      >
        {useBrowserWallet
          ? `Settles from your connected wallet ${short(wallet.address)} on Arc testnet.`
          : "Settles from the Float facility. Connect a wallet in the header to pay from your own instead."}
      </div>

      <div className="panel-sunk flex items-center justify-between gap-4 px-4 py-3.5">
        <div>
          <Label>Outstanding</Label>
          <div className="mn mt-1.5" style={{ fontSize: 20 }}>
            {usd(agent.outstandingDebt)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setAmount(agent.outstandingDebt.toFixed(2));
            setError(null);
          }}
          className="btn"
        >
          Pay it all
        </button>
      </div>

      <form id="repay-form" onSubmit={submit}>
        <Field label="Amount" suffix="USDC">
          <input
            type="number"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            autoFocus
            className="field"
            style={{ paddingRight: 56 }}
          />
        </Field>
      </form>

      {value > 0 && (
        <div>
          <Kv k="Principal cleared" v={usd(principalPart)} />
          <Kv k="Interest and origination" v={usd(feePart)} tone="flare" />
          <Kv k="Still owed afterwards" v={usd(remaining)} />
          <Kv k="Headroom restored" v={`+ ${usd(Math.min(agent.outstandingDebt, value))}`} tone="sea" />
        </div>
      )}

      <div className="note">
        {agent.isAutonomous
          ? "This agent signs for itself. Real USDC leaves its own Arc address."
          : "Real USDC moves on Arc testnet to clear the facility and restore the line."}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
    </Sheet>
  );
};
