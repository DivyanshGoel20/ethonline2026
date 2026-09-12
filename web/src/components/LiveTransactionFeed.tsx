"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Label, short, usd } from "./ui";

interface LiveTransactionFeedProps {
  humanOwner?: string | null;
  refreshTrigger?: number;
}

type Kind = "x402" | "draw" | "settle" | "pending";

interface TapeItem {
  id: string;
  kind: Kind;
  text: string;
  amount: number;
  timestamp: number;
  time: string;
  txHash?: string;
  txLink?: string;
}

const KIND_COLOR: Record<Kind, string> = {
  x402: "var(--flare)",
  draw: "var(--sea)",
  settle: "var(--ink2)",
  pending: "var(--ink3)",
};

/**
 * The settlement tape.
 *
 * Reads drawdowns and repayments straight off the facility contract on Arc
 * and prints one line per event. Deliberately not a card grid: a credit
 * facility produces a chronological record, so it reads as one.
 */
export const LiveTransactionFeed: React.FC<LiveTransactionFeedProps> = ({
  humanOwner,
  refreshTrigger = 0,
}) => {
  const [items, setItems] = useState<TapeItem[]>([]);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const url = humanOwner
          ? `/api/contract-telemetry?human=${encodeURIComponent(humanOwner)}`
          : "/api/contract-telemetry";
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (cancelled || !json.success || !json.telemetry) return;

        const t = json.telemetry;
        setLatestBlock(t.network?.latestBlock ?? null);

        const next: TapeItem[] = [];

        for (const d of t.drawdowns ?? []) {
          const isX402 =
            typeof d.paymentReference === "string" &&
            (d.paymentReference.includes("x402") || d.paymentReference.includes("http"));
          next.push({
            id: `draw_${d.loanId}`,
            kind: isX402 ? "x402" : "draw",
            text: isX402
              ? `${short(d.agentAddress)} paid an x402 challenge it could not fund`
              : `${short(d.agentAddress)} drew against the human facility`,
            amount: d.amountUsdc,
            timestamp: d.timestamp * 1000,
            time: d.timestampIso ? new Date(d.timestampIso).toLocaleTimeString() : "—",
            txHash: d.txHash,
            txLink: d.txLink || (d.txHash ? `https://testnet.arcscan.app/tx/${d.txHash}` : undefined),
          });
        }

        // Booked, not yet on chain. Shown so the tape reflects what is owed
        // rather than only what has been proved, and so a batch landing reads
        // as these lines collapsing into one settled row.
        for (const p of t.pending ?? []) {
          next.push({
            id: `pending_${p.id}`,
            kind: "pending",
            text: `${short(p.agentAddress)} paid an x402 charge \u00b7 ${
              p.settling ? "settling on Arc" : "awaiting batch"
            }`,
            amount: p.amountUsdc,
            timestamp: p.timestamp * 1000,
            time: p.timestampIso ? new Date(p.timestampIso).toLocaleTimeString() : "\u2014",
          });
        }

        for (const r of t.repayments ?? []) {
          next.push({
            id: `settle_${r.repaymentId}`,
            kind: "settle",
            text: `${short(r.beneficiaryAgent || r.payer)} cleared principal and interest`,
            amount: r.amountUsdc,
            timestamp: r.timestamp * 1000,
            time: r.timestampIso ? new Date(r.timestampIso).toLocaleTimeString() : "—",
            txHash: r.txHash,
            txLink: r.txHash ? `https://testnet.arcscan.app/tx/${r.txHash}` : undefined,
          });
        }

        next.sort((a, b) => b.timestamp - a.timestamp);
        setItems(next.slice(0, 8));
      } catch {
        /* transient RPC hiccup; the next tick retries */
      }
    };

    poll();
    const id = setInterval(poll, 7000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [humanOwner, refreshTrigger]);

  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <Label>Settlement tape</Label>
        <span className="mn faint" style={{ fontSize: 9 }}>
          live from Arc{latestBlock ? ` · block #${latestBlock}` : ""}
        </span>
      </div>

      <div style={{ borderTop: "1px solid var(--ink)" }}>
        {items.length === 0 ? (
          <div className="py-8 dim" style={{ fontSize: 13 }}>
            Nothing on the tape yet. Draw against the line, or let an agent hit a 402, and it prints
            here.
          </div>
        ) : (
          items.map((e) => (
            <div
              key={e.id}
              className="hairline flex flex-wrap items-baseline gap-x-5 gap-y-1 py-2.5"
            >
              <span className="mn faint shrink-0" style={{ fontSize: 9.5, width: 76 }}>
                {e.time}
              </span>
              <span
                className="mn shrink-0"
                style={{ fontSize: 9, letterSpacing: "0.16em", width: 60, color: KIND_COLOR[e.kind] }}
              >
                {e.kind.toUpperCase()}
              </span>
              <span className="dim flex-1 min-w-[200px]" style={{ fontSize: 13 }}>
                {e.text}
              </span>
              <span className="mn shrink-0" style={{ fontSize: 12 }}>
                {e.kind === "settle" ? "−" : "+"}
                {usd(e.amount)}
              </span>
              {e.txLink ? (
                <a
                  href={e.txLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mn faint inline-flex items-center gap-1 shrink-0 hover:text-[color:var(--ink)] transition-colors"
                  style={{ fontSize: 9.5, width: 96 }}
                >
                  <span>{short(e.txHash, 6, 4)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span style={{ width: 96 }} />
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};
