"use client";

import React, { useState, useEffect, useRef } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import { Agent } from "@/types";
import { Sheet, Field, Kv, Label, ErrorNote, short, usd } from "./ui";
import type { Rail } from "@/lib/rails";

interface X402PayModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  facilityAvailable?: number;
  /** Which rail settles this payment. Arc keeps the debt ledger regardless. */
  rail?: Rail;
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
  rail = "arc",
  onPaymentSuccess,
}) => {
  // The premium API is a separate Express service. Pointing this at the Next
  // app just 404s, which is not a payment failure but looks exactly like one.
  const [url, setUrl] = useState(
    process.env.NEXT_PUBLIC_X402_RESOURCE_URL || "http://localhost:4402/premium-data"
  );
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [wallet, setWallet] = useState<string>("0.00");
  const [gateway, setGateway] = useState<string>("0.00");
  const [catalogue, setCatalogue] = useState<
    Array<{ path: string; price: number; title: string; artifact: string }>
  >([]);
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

    fetch(rail === "hedera" ? "/api/hedera/status" : "/api/x402/catalogue")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.resources) ? d.resources : [];
        setCatalogue(list);
        // Default to the cheapest thing on offer rather than a hardcoded path.
        if (list.length && d.base) setUrl(`${String(d.base).replace(/\/$/, "")}${list[0].path}`);
      })
      .catch(() => setCatalogue([]));

    fetch(`/api/pay?agentAddress=${agent.address}`)
      .then((r) => r.json())
      .then((d) => {
        setWallet(d.walletUsdc ?? "0.00");
        setGateway(d.gatewayAvailableUSDC ?? "0.00");
      })
      .catch(() => {
        setWallet("0.00");
        setGateway("0.00");
      });

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
      const res = await fetch(rail === "hedera" ? "/api/hedera/pay" : "/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // humanProfileId is deliberately absent: the route takes the human from
        // the World session, because naming one in the body meant billing them.
        // The Hedera rail pays from its own configured identity, so it needs
        // only the resource.
        body: JSON.stringify(
          rail === "hedera" ? { url } : { url, agentAddress: agent.address }
        ),
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
      subtitle={
        rail === "hedera"
          ? "Hedera · Blocky402 · repayment parked on consensus"
          : `${agent.name} · ${short(agent.address)} · Arc`
      }
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

      {catalogue.length > 0 && (
        <div>
          <Label className="mb-2.5">On sale</Label>
          <div className="flex flex-wrap gap-2">
            {catalogue.map((r) => {
              const full = url.endsWith(r.path);
              return (
                <button
                  key={r.path}
                  onClick={() => setUrl(url.replace(/\/[^/]*$/, "") + r.path)}
                  disabled={busy}
                  className="btn"
                  data-on={full}
                  style={full ? { borderColor: "var(--ink)", color: "var(--ink)" } : undefined}
                  title={`${r.title} \u00b7 ${r.artifact}`}
                >
                  {r.title} &middot; ${r.price.toFixed(2)}
                </button>
              );
            })}
          </div>
          {catalogue.some((r) => r.price > available) && (
            <div className="mn faint mt-2.5" style={{ fontSize: 9.5 }}>
              anything above {usd(available)} will be refused by the facility
            </div>
          )}
        </div>
      )}

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

      {rail === "arc" && (
      <div className="panel-sunk flex">
        <div className="flex-1 px-4 py-3.5" style={{ borderRight: "1px solid var(--rule)" }}>
          <Label>Wallet</Label>
          <div className="mn mt-1.5" style={{ fontSize: 19 }}>
            ${wallet}
          </div>
        </div>
        <div className="flex-1 px-4 py-3.5" style={{ borderRight: "1px solid var(--rule)" }}>
          <Label>Circle Gateway</Label>
          <div
            className="mn mt-1.5"
            style={{ fontSize: 19, color: parseFloat(gateway) > 0 ? "var(--ink)" : "var(--flare)" }}
          >
            ${gateway}
          </div>
        </div>
        <div className="flex-1 px-4 py-3.5">
          <Label>Line has left</Label>
          <div className="mn mt-1.5" style={{ fontSize: 19, color: "var(--sea)" }}>
            {usd(available)}
          </div>
        </div>
      </div>
      )}

      {rail === "hedera" && (
        <div className="note">
          This rail pays from Float&rsquo;s Hedera identity and, when the agent is short,
          parks a dated repayment on consensus before the money moves. Nobody has to be
          online when it falls due.
        </div>
      )}

      {parseFloat(wallet) > 0 && parseFloat(gateway) <= 0 && (
        <div className="note note-warn" style={{ color: "var(--ink2)" }}>
          This agent holds ${wallet} on Arc but has nothing deposited into Circle Gateway, so it
          cannot settle the charge from its own funds. This is the gap the overdraft covers.
        </div>
      )}

      {/* the sequence */}
      {/*
        The rail is drawn per row rather than as one absolutely-positioned line.
        A single spine has to guess where the dots are - it sat 4px left of their
        centres, overshot the last one, and its progress height assumed every row
        was the same height, which stops being true the moment a line wraps.
        Here each connector stretches between the dot above it and the dot below,
        so alignment is structural.
      */}
      <div className="flex flex-col">
        {STEPS.map((s, i) => {
          const on = step >= i + 1;
          const nextOn = step >= i + 2;
          const flare = i === 2;
          const last = i === STEPS.length - 1;
          const colour = flare ? "var(--flare)" : "var(--sea)";

          return (
            <div
              key={s.k}
              className="flex gap-5 transition-all duration-500"
              style={{ opacity: on ? 1 : 0.25, transform: on ? "none" : "translateY(4px)" }}
            >
              <div className="flex flex-col items-center shrink-0" style={{ width: 9 }}>
                <span
                  className="rounded-full shrink-0"
                  style={{
                    width: 9,
                    height: 9,
                    marginTop: 5,
                    border: `1px solid ${on ? colour : "var(--rule)"}`,
                    background: on ? colour : "transparent",
                  }}
                />
                {!last && (
                  <span
                    className="transition-colors duration-500"
                    style={{
                      flex: 1,
                      width: 1,
                      marginTop: 3,
                      background: nextOn ? "var(--sea)" : "var(--rule)",
                    }}
                  />
                )}
              </div>

              <div style={{ paddingBottom: last ? 0 : 18 }}>
                <span style={{ fontSize: 14 }}>{s.line}</span>
              </div>
            </div>
          );
        })}
      </div>

      {done && rail === "hedera" && (
        <div>
          <Kv
            k="Funded by"
            v={result.fundedBy === "agent" ? "the agent itself" : "Float credit"}
            tone={result.fundedBy === "agent" ? "ink" : "flare"}
          />
          <Kv k="Amount" v={`$${result.amount} USDC`} />
          {result.scheduledRepayment && (
            <>
              <Kv k="Repayment due" v={result.scheduledRepayment.dueAt} tone="faint" />
              <Kv
                k="Parked on consensus"
                v={
                  <a className="link" href={result.links?.schedule ?? "#"} target="_blank" rel="noopener noreferrer">
                    {result.scheduledRepayment.scheduleId} <ExternalLink className="w-3 h-3 inline" />
                  </a>
                }
              />
            </>
          )}
          {result.links?.transaction && (
            <Kv
              k="Settlement"
              v={
                <a className="link" href={result.links.transaction} target="_blank" rel="noopener noreferrer">
                  view on HashScan <ExternalLink className="w-3 h-3 inline" />
                </a>
              }
            />
          )}
        </div>
      )}

      {done && rail === "arc" && (
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

          {result.data?.artifact === "svg" && result.data?.svg ? (
            <div className="mt-4">
              <Label className="mb-2">{result.data.title || "What the payment bought"}</Label>
              {/* Rendered through an img rather than injected as markup: the
                  document comes from a resource server, and an <img> cannot run
                  script even if the SVG carries any. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={result.data.title || "Purchased artefact"}
                src={`data:image/svg+xml;base64,${
                  typeof window === "undefined"
                    ? ""
                    : window.btoa(unescape(encodeURIComponent(result.data.svg)))
                }`}
                style={{ width: "100%", border: "1px solid var(--rule)", display: "block" }}
              />
            </div>
          ) : result.data !== undefined ? (
            <div className="mt-4">
              <Label className="mb-2">What the resource returned</Label>
              <pre className="code" style={{ maxHeight: 180, overflowY: "auto" }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          ) : null}
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
