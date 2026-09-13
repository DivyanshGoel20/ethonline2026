"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Label, ErrorNote, usd } from "./ui";

interface Parked {
  scheduleId: string;
  amountUsd: number;
  dueAt: string;
  resource: string;
  link: string;
  dueInMs: number;
}

const dueIn = (ms: number) => {
  if (ms <= 0) return "due now";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `in ${d}d ${h}h` : `in ${h}h`;
};

/**
 * Repayments parked on Hedera consensus.
 *
 * These execute on their own date whether or not anyone is watching, which is
 * the point - and the reason they need to be visible and cancellable. Settling
 * early used to mean paying twice, because nothing tore up the parked transfer.
 */
export const HederaObligations: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger }) => {
  const [rows, setRows] = useState<Parked[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hedera/schedules");
      if (!res.ok) return;
      const d = await res.json();
      setRows(Array.isArray(d.schedules) ? d.schedules : []);
    } catch {
      /* rail not running; section stays hidden */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  const settle = async (scheduleId: string) => {
    setBusy(scheduleId);
    setError(null);
    try {
      const res = await fetch("/api/hedera/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Could not settle early.");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return null;

  const total = rows.reduce((n, r) => n + r.amountUsd, 0);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-3">
        <div className="flex items-baseline gap-3">
          <span className="serif" style={{ fontSize: 26 }}>
            Parked on Hedera
          </span>
          <span className="mn faint" style={{ fontSize: 9.5 }}>
            {rows.length} repayment{rows.length === 1 ? "" : "s"} totalling {usd(total)}
          </span>
        </div>
        <Label>Executes on its date without anyone online</Label>
      </div>

      <div style={{ borderTop: "1px solid var(--ink)" }}>
        {rows.map((r) => (
          <div
            key={r.scheduleId}
            className="row-hover hairline flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5"
          >
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mn link"
              style={{ fontSize: 11, width: 132 }}
            >
              {r.scheduleId} <ExternalLink className="w-3 h-3 inline" />
            </a>
            <span className="dim flex-1 min-w-[160px]" style={{ fontSize: 13 }}>
              {r.resource.replace(/^https?:\/\//, "")}
            </span>
            <span className="mn" style={{ fontSize: 13 }}>
              {usd(r.amountUsd)}
            </span>
            <span
              className="mn"
              style={{ fontSize: 9.5, width: 96, color: r.dueInMs <= 0 ? "var(--flare)" : "var(--ink3)" }}
            >
              {dueIn(r.dueInMs)}
            </span>
            <button
              onClick={() => settle(r.scheduleId)}
              disabled={busy === r.scheduleId}
              className="btn btn-strong"
              title="Pay now and delete the parked transfer"
            >
              {busy === r.scheduleId ? "Settling…" : "Settle early"}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </section>
  );
};
