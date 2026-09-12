"use client";

import React, { useState, useEffect, useRef } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import { Agent } from "@/types";
import { Sheet, Field, Kv, Label, ErrorNote, short, usd } from "./ui";

interface X402PayModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  facilityAvailable?: number;
  onPaymentSuccess?: (result: any) => void;
}

const STEPS = [
  { k: "Request", line: "The agent asks for a resource it has to pay for." },
  { k: "Balance", line: "Its wallet cannot cover the charge." },
  { k: "Overdraft", line: "Float advances the shortfall against the human who vouched for it." },
  { k: "Settlement", line: "The x402 header is signed and the resource comes back." },
];

/**
 * The overdraft, watched live.
 *
 * The whole pitch is one status code turning into another, so the status code
 * is the biggest thing on the screen. Steps light up as the real request runs;
 * the timings below only pace the first three while the round trip is in
 * flight — step four waits for the server.
 */
export const X402PayModal: React.FC<X402PayModalProps> = ({
  agent,
  isOpen,
  onClose,
  facilityAvailable,
  onPaymentSuccess,
}) => {
  const [url, setUrl] = useState("http://localhost:3000/premium-data");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [wallet, setWallet] = useState<string>("0.00");
  const [copied, setCopied] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    if (!isOpen || !agent) return;

    setResult(null);
    setError(null);
    setStep(0);
    clearTimers();

    fetch(`/api/pay?agentAddress=${agent.address}`)
      .then((r) => r.json())
      .then((d) => setWallet(d.gatewayAvailableUSDC ?? "0.00"))
      .catch(() => setWallet("0.00"));

    return clearTimers;
  }, [isOpen, agent]);

  if (!isOpen || !agent) return null;

  const available = facilityAvailable ?? Math.max(0, agent.creditLimit - agent.outstandingDebt);
  const done = !!result;

  const pay = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setStep(1);

    timers.current.push(setTimeout(() => setStep(2), 500));
    timers.current.push(setTimeout(() => setStep(3), 1100));

    try {
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // humanProfileId is deliberately absent: the route takes the human from
        // the World session, because naming one in the body meant billing them.
        body: JSON.stringify({ url, agentAddress: agent.address }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new Error("Your World session expired. Verify again to spend on the line.");
      }
      if (!res.ok || !data.success) throw new Error(data.error || "The payment did not go through");

      clearTimers();
      setStep(4);
      setResult(data);
      onPaymentSuccess?.(data);
    } catch (err: any) {
      clearTimers();
      console.error("[X402PayModal] Overdraft error:", err);
      setError(err.message || "The payment did not go through");
      setStep(0);
    } finally {
      setBusy(false);
    }
  };

  const txHash =
    result?.arcTxHash ||
    (typeof result?.transactionId === "string" && result.transactionId.startsWith("0x")
      ? result.transactionId
      : undefined);

  const settlementId =
    result?.circleSettlementId ||
    (typeof result?.transactionId === "string" && !result.transactionId.startsWith("0x")
      ? result.transactionId
      : undefined);

  return (
    <Sheet
      open={isOpen}
      onClose={() => {
        clearTimers();
        onClose();
      }}
      title="Pay a 402"
      subtitle={`${agent.name} · ${short(agent.address)}`}
      width={620}
      footer={
        <>
          <button
            onClick={() => {
              clearTimers();
              onClose();
            }}
            className="btn"
          >
            {done ? "Close" : "Cancel"}
          </button>
          {done ? (
            <button
              onClick={() => {
                setResult(null);
                setStep(0);
              }}
              className="btn btn-strong"
            >
              Run it again
            </button>
          ) : (
            <button onClick={pay} disabled={busy || available < 0.01} className="btn btn-flare">
              {busy ? "Settling…" : "Pay with the overdraft"}
            </button>
          )}
        </>
      }
    >
      {/* the status code */}
      <div className="panel-sunk px-6 py-5 flex items-baseline gap-6">
        <span
          className="serif transition-colors duration-700"
          style={{
            fontSize: 92,
            lineHeight: 0.8,
            letterSpacing: "-0.05em",
            color: done ? "var(--sea)" : "var(--flare)",
          }}
        >
          {done ? "200" : "402"}
        </span>
        <div>
          <div className="serif" style={{ fontSize: 26, color: done ? "var(--sea)" : "var(--flare)" }}>
            {done ? "OK" : "Payment Required"}
          </div>
          <div className="mn faint mt-2" style={{ fontSize: 9.5, lineHeight: 1.9 }}>
            <div>x-payment: {done ? "signed by float" : "absent"}</div>
            <div>accepts: usdc &middot; arc-testnet</div>
          </div>
        </div>
      </div>

      <Field
        label="Resource"
        hint="Any endpoint that answers 402 with an x402 challenge."
      >
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
          className="field"
          style={{ fontSize: 12 }}
        />
      </Field>

      <div className="panel-sunk flex">
        <div className="flex-1 px-4 py-3.5" style={{ borderRight: "1px solid var(--rule)" }}>
          <Label>Agent wallet</Label>
          <div
            className="mn mt-1.5"
            style={{ fontSize: 19, color: parseFloat(wallet) > 0 ? "var(--ink)" : "var(--flare)" }}
          >
            ${wallet}
          </div>
        </div>
        <div className="flex-1 px-4 py-3.5">
          <Label>Line has left</Label>
          <div className="mn mt-1.5" style={{ fontSize: 19, color: "var(--sea)" }}>
            {usd(available)}
          </div>
        </div>
      </div>

      {/* the sequence */}
      <div className="relative pl-8">
        <div
          className="absolute left-[4px] top-2"
          style={{ width: 1, background: "var(--rule)", height: "calc(100% - 24px)" }}
        />
        <div
          className="absolute left-[4px] top-2 transition-[height] duration-500"
          style={{ width: 1, background: "var(--sea)", height: `${Math.min(step, 4) * 25}%` }}
        />

        {STEPS.map((s, i) => {
          const on = step >= i + 1;
          const flare = i === 2;
          return (
            <div
              key={s.k}
              className="relative mb-4 last:mb-0 transition-all duration-500"
              style={{ opacity: on ? 1 : 0.25, transform: on ? "none" : "translateY(4px)" }}
            >
              <span
                className="absolute rounded-full"
                style={{
                  left: -28,
                  top: 5,
                  width: 9,
                  height: 9,
                  border: `1px solid ${on ? (flare ? "var(--flare)" : "var(--sea)") : "var(--rule)"}`,
                  background: on ? (flare ? "var(--flare)" : "var(--sea)") : "transparent",
                }}
              />
              <span style={{ fontSize: 14 }}>{s.line}</span>
            </div>
          );
        })}
      </div>

      {done && (
        <div>
          {txHash && (
            <Kv
              k="Arc transaction"
              v={
                <a
                  className="link"
                  href={result.arcTxLink || `https://testnet.arcscan.app/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {short(txHash, 8, 6)} <ExternalLink className="w-3 h-3 inline" />
                </a>
              }
            />
          )}
          {settlementId && (
            <Kv
              k="Circle settlement"
              v={
                <button
                  className="mn inline-flex items-center gap-1.5 hover:text-[color:var(--ink)]"
                  onClick={() => {
                    navigator.clipboard.writeText(settlementId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  }}
                >
                  {short(settlementId, 10, 4)}
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              }
            />
          )}
          <Kv k="Now owed" v={usd(result.agentDebt ?? 0.01)} tone="flare" />

          {result.data !== undefined && (
            <div className="mt-4">
              <Label className="mb-2">What the resource returned</Label>
              <pre className="code" style={{ maxHeight: 180, overflowY: "auto" }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {!done && (
        <div className="note note-warn" style={{ color: "var(--ink2)" }}>
          Without Float this call simply fails: the agent has no balance and no way to get one
          without a human in the loop. The advance is recorded as debt on your facility, not the
          agent&rsquo;s.
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
    </Sheet>
  );
};
