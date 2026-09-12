"use client";

import React, { useState, useEffect } from "react";
import { Agent } from "@/types";
import { Sheet, Field, Kv, Label, ErrorNote, usd, short } from "./ui";

interface BorrowModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBorrow: (agentAddress: string, amount: number) => Promise<void>;
  maxFacilityCredit?: number;
}

export const BorrowModal: React.FC<BorrowModalProps> = ({
  agent,
  isOpen,
  onClose,
  onConfirmBorrow,
  maxFacilityCredit,
}) => {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !agent) return null;

  const headroom =
    maxFacilityCredit !== undefined
      ? maxFacilityCredit
      : Math.max(0, agent.creditLimit - agent.outstandingDebt);

  const value = parseFloat(amount) || 0;
  const overLimit = value > headroom + 0.005;

  const fee = Math.round(value * 0.01 * 1000) / 1000;
  const dueNow = Math.round((value + fee) * 1000) / 1000;
  const left = Math.max(0, Math.round((headroom - value) * 100) / 100);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (value <= 0) return setError("Enter an amount above zero.");
    if (overLimit) return setError(`That is more than the line has left (${usd(headroom)}).`);

    setBusy(true);
    try {
      await onConfirmBorrow(agent.address, value);
      onClose();
    } catch (err: any) {
      setError(err.message || "The draw did not settle.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Draw on the line"
      subtitle={`${agent.name} · ${short(agent.address)}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn">
            Cancel
          </button>
          <button
            type="submit"
            form="borrow-form"
            disabled={busy || value <= 0 || overLimit}
            className="btn btn-solid"
          >
            {busy ? "Settling on Arc…" : "Confirm draw"}
          </button>
        </>
      }
    >
      <div className="panel-sunk flex">
        <div className="flex-1 px-4 py-3.5" style={{ borderRight: "1px solid var(--rule)" }}>
          <Label>Line has left</Label>
          <div className="mn mt-1.5" style={{ fontSize: 20, color: "var(--sea)" }}>
            {usd(headroom)}
          </div>
        </div>
        <div className="flex-1 px-4 py-3.5">
          <Label>{agent.name} owes</Label>
          <div className="mn mt-1.5" style={{ fontSize: 20 }}>
            {usd(agent.outstandingDebt)}
          </div>
        </div>
      </div>

      <form id="borrow-form" onSubmit={submit}>
        <Field
          label="Amount"
          suffix="USDC"
          right={
            <div className="flex gap-1.5">
              {[0.25, 0.5, 1].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setAmount((headroom * pct).toFixed(2));
                    setError(null);
                  }}
                  className="btn"
                  style={{ height: 22, padding: "0 8px", fontSize: 8.5 }}
                >
                  {pct === 1 ? "Max" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          }
        >
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
          <Kv k="Lands in the agent wallet" v={usd(value)} />
          <Kv k="Origination, 1%" v={`+ ${usd(fee)}`} tone="flare" />
          <Kv k="Owed immediately" v={usd(dueNow)} />
          <Kv k="Line left afterwards" v={usd(left)} tone={left === 0 ? "flare" : "faint"} />
        </div>
      )}

      <div className="note">
        Interest runs at 0.05% a day and this tranche is due in full within 7 days. Repayments clear
        the oldest tranche first.
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
    </Sheet>
  );
};
