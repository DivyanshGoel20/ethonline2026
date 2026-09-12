"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import { Agent } from "@/types";
import { Sheet, Kv, Label, ErrorNote, short } from "./ui";

const AGENTBOOK = "0xA23aB2712eA7BBa896930544C7d6636a96b944dA";

interface AgentKitRegisterModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onVerified: (updatedAgent: Agent) => void;
}

type Flow =
  | "NOT_CHECKED"
  | "NOT_REGISTERED"
  | "INITIALIZING_BRIDGE"
  | "WAITING_FOR_WORLD_APP"
  | "SUBMITTING_AGENTBOOK"
  | "REGISTERED_HUMAN_BACKED"
  | "REGISTRATION_FAILED";

export const AgentKitRegisterModal: React.FC<AgentKitRegisterModalProps> = ({
  agent,
  isOpen,
  onClose,
  onVerified,
}) => {
  const [tab, setTab] = useState<"app" | "cli">("app");
  const [state, setState] = useState<Flow>("NOT_CHECKED");
  const [qr, setQr] = useState<string | null>(null);
  const [connectorURI, setConnectorURI] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (poll.current) {
      clearInterval(poll.current);
      poll.current = null;
    }
  };

  useEffect(() => {
    stopPolling();
    setQr(null);
    setConnectorURI(null);
    setNonce(null);
    setTxHash(null);
    setError(null);
    setCopied(false);
    setChecking(false);

    if (isOpen && agent) {
      if (agent.isWorldBacked || agent.agentBookStatus === "VERIFIED") {
        setState("REGISTERED_HUMAN_BACKED");
        if (agent.agentBookTxHash) setTxHash(agent.agentBookTxHash);
      } else {
        checkInitialStatus(agent.address);
      }
    } else {
      setState("NOT_CHECKED");
    }

    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, agent?.address]);

  const checkInitialStatus = async (address: string) => {
    setState("NOT_CHECKED");
    try {
      const res = await fetch("/api/agent/verify-agentkit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentAddress: address }),
      });
      const data = await res.json();
      if (data.isWorldBacked && data.agent) {
        setState("REGISTERED_HUMAN_BACKED");
        onVerified(data.agent);
      } else {
        setState("NOT_REGISTERED");
      }
    } catch {
      setState("NOT_REGISTERED");
    }
  };

  const startRegistration = async () => {
    if (!agent) return;
    stopPolling();
    setState("INITIALIZING_BRIDGE");
    setError(null);

    try {
      const res = await fetch("/api/agent/registration-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentAddress: agent.address }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Could not open a bridge session");

      if (data.alreadyRegistered) {
        setState("REGISTERED_HUMAN_BACKED");
        onVerified({ ...agent, isWorldBacked: true, agentBookStatus: "VERIFIED" });
        return;
      }

      setConnectorURI(data.connectorURI);
      setNonce(data.nonce);
      setQr(
        await QRCode.toDataURL(data.connectorURI, {
          width: 320,
          margin: 1,
          color: { dark: "#17150f", light: "#f3f0e7" },
        })
      );
      setState("WAITING_FOR_WORLD_APP");
      startPolling(data.sessionId);
    } catch (err: any) {
      console.error("[AgentKitRegisterModal] Bridge error:", err);
      setState("REGISTRATION_FAILED");
      setError(err.message || "Could not reach the World ID bridge.");
    }
  };

  const startPolling = (sessionId: string) => {
    stopPolling();
    poll.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/agent/registration-session?sessionId=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();

        if (data.status === "SUBMITTING_AGENTBOOK") {
          setState("SUBMITTING_AGENTBOOK");
        } else if (data.status === "REGISTERED_HUMAN_BACKED") {
          stopPolling();
          setState("REGISTERED_HUMAN_BACKED");
          setTxHash(data.txHash || null);
          if (agent) {
            onVerified({
              ...agent,
              isWorldBacked: true,
              agentBookStatus: "VERIFIED",
              agentBookTxHash: data.txHash,
            });
          }
        } else if (data.status === "REGISTRATION_FAILED") {
          stopPolling();
          setState("REGISTRATION_FAILED");
          setError(data.error || "Verification was cancelled in World App.");
        }
      } catch {
        /* keep polling; the next tick retries */
      }
    }, 1500);
  };

  const checkOnChain = async () => {
    if (!agent) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/verify-agentkit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentAddress: agent.address }),
      });
      const data = await res.json();
      if (data.isWorldBacked && data.agent) {
        setState("REGISTERED_HUMAN_BACKED");
        onVerified(data.agent);
      } else {
        setError(`Still unregistered in AgentBook (${short(AGENTBOOK)}).`);
      }
    } catch (err: any) {
      setError(err.message || "Could not reach World Chain.");
    } finally {
      setChecking(false);
    }
  };

  if (!isOpen || !agent) return null;

  const command = `npx @worldcoin/agentkit-cli register ${agent.address}`;
  const close = () => {
    stopPolling();
    onClose();
  };

  return (
    <Sheet
      open={isOpen}
      onClose={close}
      title="Back it with a human"
      subtitle={`${agent.name} · World Chain (480)`}
      width={560}
      footer={
        <button onClick={close} className="btn">
          {state === "REGISTERED_HUMAN_BACKED" ? "Done" : "Close"}
        </button>
      }
    >
      {state === "NOT_CHECKED" && (
        <div className="py-10 text-center">
          <RefreshCw className="w-5 h-5 spin mx-auto" style={{ color: "var(--ink3)" }} />
          <div className="mn faint mt-3" style={{ fontSize: 10 }}>
            checking AgentBook&hellip;
          </div>
        </div>
      )}

      {state === "REGISTERED_HUMAN_BACKED" && (
        <>
          <div className="note">
            Registered in AgentBook on World Chain. This wallet is recognised as backed by a verified
            human.
          </div>
          <div>
            <Kv k="Agent" v={short(agent.address, 8, 6)} />
            <Kv k="Registry" v={short(AGENTBOOK)} tone="faint" />
            {txHash && (
              <Kv
                k="Registration tx"
                v={
                  <a
                    className="link"
                    href={`https://worldscan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {short(txHash, 8, 6)} <ExternalLink className="w-3 h-3 inline" />
                  </a>
                }
              />
            )}
          </div>
        </>
      )}

      {state !== "REGISTERED_HUMAN_BACKED" && state !== "NOT_CHECKED" && (
        <>
          <div className="flex gap-2">
            <button onClick={() => setTab("app")} className="tab" data-on={tab === "app"}>
              World App
            </button>
            <button onClick={() => setTab("cli")} className="tab" data-on={tab === "cli"}>
              CLI
            </button>
          </div>

          {tab === "app" && (
            <>
              {state === "NOT_REGISTERED" && (
                <div className="text-center py-6">
                  <p className="dim mx-auto" style={{ fontSize: 14, maxWidth: "40ch", lineHeight: 1.6 }}>
                    This builds a registration request bound to the agent address and the registry&rsquo;s
                    current nonce. You approve it in World App.
                  </p>
                  <button onClick={startRegistration} className="btn btn-solid mt-5">
                    Start registration
                  </button>
                </div>
              )}

              {state === "INITIALIZING_BRIDGE" && (
                <div className="py-10 text-center">
                  <RefreshCw className="w-5 h-5 spin mx-auto" style={{ color: "var(--sea)" }} />
                  <div className="mn faint mt-3" style={{ fontSize: 10 }}>
                    fetching nonce, opening session&hellip;
                  </div>
                </div>
              )}

              {state === "WAITING_FOR_WORLD_APP" && qr && (
                <div className="text-center">
                  <div
                    className="inline-block p-3"
                    style={{ border: "1px solid var(--ink)", background: "var(--paper)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="World ID registration QR code" width={192} height={192} />
                  </div>

                  <div className="flex items-center justify-center gap-2.5 mt-4">
                    <span
                      className="blip"
                      style={{ width: 6, height: 6, background: "var(--sea)", display: "block" }}
                    />
                    <span className="mn" style={{ fontSize: 10, color: "var(--sea)" }}>
                      waiting for World App
                    </span>
                  </div>

                  <p className="dim mt-2" style={{ fontSize: 13 }}>
                    Scan it with World App on your phone.
                  </p>

                  {connectorURI && (
                    <a
                      href={connectorURI}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn mt-4"
                    >
                      Open in World App
                    </a>
                  )}

                  {nonce && (
                    <div className="mn faint mt-4" style={{ fontSize: 9 }}>
                      nonce {nonce} &middot; {short(AGENTBOOK)}
                    </div>
                  )}
                </div>
              )}

              {state === "SUBMITTING_AGENTBOOK" && (
                <div className="py-10 text-center">
                  <RefreshCw className="w-5 h-5 spin mx-auto" style={{ color: "var(--sea)" }} />
                  <div className="serif mt-4" style={{ fontSize: 22 }}>
                    Verified.
                  </div>
                  <div className="mn faint mt-2" style={{ fontSize: 10 }}>
                    writing the AgentBook registration to World Chain&hellip;
                  </div>
                </div>
              )}

              {state === "REGISTRATION_FAILED" && (
                <div className="text-center py-4">
                  <ErrorNote>{error || "World ID verification did not complete."}</ErrorNote>
                  <button onClick={startRegistration} className="btn btn-strong mt-4">
                    Try again
                  </button>
                </div>
              )}
            </>
          )}

          {tab === "cli" && (
            <>
              <div>
                <div className="flex items-baseline justify-between gap-4 mb-2.5">
                  <Label>Register from a terminal</Label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(command);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    }}
                    className="btn"
                    style={{ height: 24, fontSize: 8.5 }}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="code">{command}</pre>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="dim" style={{ fontSize: 13 }}>
                  Registered it elsewhere?
                </span>
                <button onClick={checkOnChain} disabled={checking} className="btn">
                  <RefreshCw className={`w-3 h-3 ${checking ? "spin" : ""}`} />
                  {checking ? "Checking…" : "Check on chain"}
                </button>
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}
            </>
          )}
        </>
      )}
    </Sheet>
  );
};
