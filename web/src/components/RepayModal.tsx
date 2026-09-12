"use client";

import React, { useState, useEffect } from "react";
import { Agent } from "@/types";
import { parseUnits } from "viem";
import { Sheet, Field, Kv, Label, ErrorNote, usd, short } from "./ui";

/** Facility operator treasury on Arc testnet. */
const TREASURY = "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3";

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
  const [useBrowserWallet, setUseBrowserWallet] = useState(false);

  useEffect(() => {
    if (isOpen && agent) {
      setAmount(agent.outstandingDebt.toFixed(2));
      setError(null);
      setUseBrowserWallet(
        typeof window !== "undefined" && !!(window as any).ethereum && !agent.isAutonomous
      );
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
        txHash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from,
              to: TREASURY,
              value: "0x" + parseUnits(value.toFixed(6), 18).toString(16),
            },
          ],
        });
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
            {busy ? "Settling on Arc…" : "Confirm repayment"}
          </button>
        </>
      }
    >
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
