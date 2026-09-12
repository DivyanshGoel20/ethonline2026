"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink, RefreshCw, ChevronDown } from "lucide-react";
import { Label, Kv, short, usd } from "./ui";

interface TelemetryData {
  network: { name: string; chainId: number; rpcUrl: string; latestBlock: number };
  contract: { address: string; owner: string; explorerUrl: string };
  profile: {
    profileId: string;
    humanOwner: string;
    humanRoot: string;
    creditLimit: number;
    outstandingDebt: number;
    remainingCredit: number;
    totalBorrowed: number;
    totalRepaid: number;
    status: string;
    createdAtIso: string;
  } | null;
  authorizedAgents: Array<{
    agentAddress: string;
    isAuthorized: boolean;
    authorizedAtIso: string;
  }>;
  drawdowns: Array<{
    loanId: number;
    agentAddress: string;
    amountUsdc: number;
    timestampIso: string;
    status: string;
    paymentReference: string;
    txHash?: string;
    txLink?: string;
  }>;
  repayments: Array<{
    repaymentId: number;
    payer: string;
    beneficiaryAgent: string;
    amountUsdc: number;
    timestampIso: string;
  }>;
  totalDrawdownsCount: number;
  totalRepaymentsCount: number;
}

interface Props {
  humanOwner?: string | null;
  refreshTrigger?: number;
}

type Tab = "profile" | "agents" | "draws" | "repayments";

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—");

/**
 * The receipts.
 *
 * Everything above this reads from the same contract, so this section exists
 * to let anyone check that claim against Arc directly. Collapsed by default —
 * it is proof, not daily furniture.
 */
export const SmartContractTelemetry: React.FC<Props> = ({ humanOwner, refreshTrigger = 0 }) => {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("profile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (manual = false) => {
    if (manual) setBusy(true);
    try {
      const url = humanOwner
        ? `/api/contract-telemetry?human=${encodeURIComponent(humanOwner)}`
        : "/api/contract-telemetry";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Arc RPC did not answer");
      setData(json.telemetry);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Arc RPC did not answer");
    } finally {
      setBusy(false);
    }
  };

  // One read on mount, so the collapsed header can show the block height.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [humanOwner, refreshTrigger]);

  // Polling only while the section is open. This is collapsed by default, so
  // it was refreshing a contract ledger nobody had on screen.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => load(), 12000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, humanOwner, refreshTrigger]);

  const tabs: Array<[Tab, string]> = [
    ["profile", "Profile"],
    ["agents", `Agents ${data?.authorizedAgents?.length ?? 0}`],
    ["draws", `Draws ${data?.totalDrawdownsCount ?? 0}`],
    ["repayments", `Repayments ${data?.totalRepaymentsCount ?? 0}`],
  ];

  return (
    <section className="panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left row-hover"
      >
        <div className="flex items-baseline gap-4">
          <Label>On-chain state</Label>
          <span className="mn faint" style={{ fontSize: 9.5 }}>
            read live from Arc
            {data?.network?.latestBlock ? ` · block #${data.network.latestBlock}` : ""}
          </span>
        </div>
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform"
          style={{ color: "var(--ink3)", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--hair)" }}>
          <div className="px-5 py-4 flex flex-wrap items-center gap-2">
            {tabs.map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} className="tab" data-on={tab === key}>
                {label}
              </button>
            ))}
            <button onClick={() => load(true)} className="btn btn-icon shrink-0" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? "spin" : ""}`} />
            </button>
          </div>

          <div className="px-5 pb-5">
            {error && (
              <div className="note note-bad" style={{ fontSize: 12.5 }}>
                {error}
              </div>
            )}

            {!error && tab === "profile" && (
              <div>
                {data?.profile ? (
                  <>
                    <Kv k="Status" v={data.profile.status} tone="sea" />
                    <Kv k="Credit limit" v={usd(data.profile.creditLimit)} />
                    <Kv k="Outstanding" v={usd(data.profile.outstandingDebt)} />
                    <Kv k="Remaining" v={usd(data.profile.remainingCredit)} />
                    <Kv k="Borrowed to date" v={usd(data.profile.totalBorrowed)} />
                    <Kv k="Repaid to date" v={usd(data.profile.totalRepaid)} />
                    <Kv k="Opened" v={when(data.profile.createdAtIso)} tone="faint" />
                    <Kv k="Profile id" v={short(data.profile.profileId, 10, 6)} tone="faint" />
                  </>
                ) : (
                  <p className="dim" style={{ fontSize: 13 }}>
                    No credit profile is open on chain for this human yet. One is created the first
                    time an agent is authorised.
                  </p>
                )}
                <div className="mt-4">
                  <a
                    className="link mn"
                    style={{ fontSize: 10 }}
                    href={data?.contract?.explorerUrl || "https://testnet.arcscan.app"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {short(data?.contract?.address, 10, 8)} on ArcScan
                  </a>
                </div>
              </div>
            )}

            {!error && tab === "agents" &&
              (data?.authorizedAgents?.length ? (
                data.authorizedAgents.map((a) => (
                  <Kv
                    key={a.agentAddress}
                    k={<span className="mn">{short(a.agentAddress, 10, 6)}</span>}
                    v={a.isAuthorized ? `authorised ${when(a.authorizedAtIso)}` : "revoked"}
                    tone={a.isAuthorized ? "sea" : "faint"}
                  />
                ))
              ) : (
                <p className="dim" style={{ fontSize: 13 }}>
                  No agent is authorised on chain yet.
                </p>
              ))}

            {!error && tab === "draws" &&
              (data?.drawdowns?.length ? (
                data.drawdowns
                  .slice()
                  .reverse()
                  .map((d) => (
                    <div key={d.loanId} className="kv">
                      <span className="dim" style={{ fontSize: 13 }}>
                        <span className="mn">#{d.loanId}</span> &middot; {short(d.agentAddress)}
                        <span className="mn faint block mt-1" style={{ fontSize: 9.5 }}>
                          {when(d.timestampIso)}
                          {d.paymentReference ? ` · ${d.paymentReference}` : ""}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="mn" style={{ fontSize: 12 }}>
                          {usd(d.amountUsdc)}
                        </span>
                        {d.txHash && (
                          <a
                            className="mn faint block mt-1 hover:text-[color:var(--ink)] transition-colors"
                            style={{ fontSize: 9.5 }}
                            href={d.txLink || `https://testnet.arcscan.app/tx/${d.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {short(d.txHash)} <ExternalLink className="w-3 h-3 inline" />
                          </a>
                        )}
                      </span>
                    </div>
                  ))
              ) : (
                <p className="dim" style={{ fontSize: 13 }}>
                  No drawdowns recorded on chain yet.
                </p>
              ))}

            {!error && tab === "repayments" &&
              (data?.repayments?.length ? (
                data.repayments
                  .slice()
                  .reverse()
                  .map((r) => (
                    <Kv
                      key={r.repaymentId}
                      k={
                        <span>
                          <span className="mn">#{r.repaymentId}</span> &middot;{" "}
                          {short(r.beneficiaryAgent || r.payer)}
                          <span className="mn faint block mt-1" style={{ fontSize: 9.5 }}>
                            {when(r.timestampIso)}
                          </span>
                        </span>
                      }
                      v={usd(r.amountUsdc)}
                    />
                  ))
              ) : (
                <p className="dim" style={{ fontSize: 13 }}>
                  No repayments recorded on chain yet.
                </p>
              ))}
          </div>
        </div>
      )}
    </section>
  );
};
