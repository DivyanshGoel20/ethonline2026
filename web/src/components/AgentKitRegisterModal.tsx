"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  X,
  Copy,
  Check,
  Globe,
  Terminal,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  QrCode,
  Smartphone,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Agent } from "@/types";

interface AgentKitRegisterModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onVerified: (updatedAgent: Agent) => void;
}

type RegistrationFlowState =
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
  const [activeTab, setActiveTab] = useState<"app" | "cli">("app");
  const [state, setState] = useState<RegistrationFlowState>("NOT_CHECKED");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [connectorURI, setConnectorURI] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedRegister, setCopiedRegister] = useState(false);
  const [isCheckingOnChain, setIsCheckingOnChain] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Reset state when agent or modal changes
  useEffect(() => {
    clearPolling();
    setQrCodeDataUrl(null);
    setConnectorURI(null);
    setSessionId(null);
    setNonce(null);
    setTxHash(null);
    setErrorMessage(null);
    setCopiedRegister(false);
    setIsCheckingOnChain(false);

    if (isOpen && agent) {
      if (agent.isWorldBacked || agent.agentBookStatus === "VERIFIED") {
        setState("REGISTERED_HUMAN_BACKED");
        if (agent.agentBookTxHash) {
          setTxHash(agent.agentBookTxHash);
        }
      } else {
        // Initial real check against live World Chain
        checkInitialStatus(agent.address);
      }
    } else {
      setState("NOT_CHECKED");
    }

    return () => clearPolling();
  }, [isOpen, agent?.address]);

  // Initial check: is it already registered in AgentBook on World Chain?
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
    } catch (err: any) {
      setState("NOT_REGISTERED");
    }
  };

  // Start real in-browser World ID Bridge registration session
  const handleStartInAppRegistration = async () => {
    if (!agent) return;
    clearPolling();
    setState("INITIALIZING_BRIDGE");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/agent/registration-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentAddress: agent.address }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to initialize bridge session");
      }

      if (data.alreadyRegistered) {
        setState("REGISTERED_HUMAN_BACKED");
        onVerified({
          ...agent,
          isWorldBacked: true,
          agentBookStatus: "VERIFIED",
        });
        return;
      }

      setSessionId(data.sessionId);
      setConnectorURI(data.connectorURI);
      setNonce(data.nonce);

      // Generate crisp QR Code data URL
      const qrUrl = await QRCode.toDataURL(data.connectorURI, {
        width: 320,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrCodeDataUrl(qrUrl);
      setState("WAITING_FOR_WORLD_APP");

      // Start polling status
      startPollingSession(data.sessionId);
    } catch (err: any) {
      console.error("[AgentKitRegisterModal] Error starting bridge:", err);
      setState("REGISTRATION_FAILED");
      setErrorMessage(err.message || "Failed to generate World ID bridge connection.");
    }
  };

  // Poll status every 1.5s
  const startPollingSession = (activeSessionId: string) => {
    clearPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/agent/registration-session?sessionId=${encodeURIComponent(activeSessionId)}`
        );
        const data = await res.json();

        if (data.status === "SUBMITTING_AGENTBOOK") {
          setState("SUBMITTING_AGENTBOOK");
        } else if (data.status === "REGISTERED_HUMAN_BACKED") {
          clearPolling();
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
          clearPolling();
          setState("REGISTRATION_FAILED");
          setErrorMessage(data.error || "Verification in World App was cancelled or failed.");
        }
      } catch (err) {
        console.warn("[AgentKitRegisterModal] Polling cycle notice:", err);
      }
    }, 1500);
  };

  // Manual Check Live on-chain status
  const handleCheckOnChain = async () => {
    if (!agent) return;
    setIsCheckingOnChain(true);
    setErrorMessage(null);
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
        setErrorMessage(
          "Unregistered on World Chain AgentBook (0xA23a...44dA). Complete registration using the QR code or CLI."
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to connect to World Chain RPC.");
    } finally {
      setIsCheckingOnChain(false);
    }
  };

  const registerCommand = agent ? `npx @worldcoin/agentkit-cli register ${agent.address}` : "";

  const handleCopyRegister = () => {
    if (!registerCommand) return;
    navigator.clipboard.writeText(registerCommand);
    setCopiedRegister(true);
    setTimeout(() => setCopiedRegister(false), 1500);
  };

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0c0d12] border border-white/[0.08] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-zinc-200">
              <Globe className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-white">World AgentKit</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-white/[0.08] text-zinc-400">
                  World Chain (480)
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Link <span className="text-zinc-300 font-medium">{agent.name}</span> to verified human identity
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              clearPolling();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Agent Info Strip */}
        <div className="p-3.5 rounded-xl bg-[#12131a] border border-white/[0.05] flex items-center justify-between text-xs font-mono">
          <div>
            <div className="text-[10px] uppercase text-zinc-500 font-semibold">Agent Wallet (Arc Testnet)</div>
            <div className="text-zinc-200 font-mono mt-0.5 truncate max-w-[280px]">
              {agent.address}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-zinc-500 font-semibold">Identity Registry</div>
            <div className="text-emerald-400 font-mono text-[11px] mt-0.5">AgentBook canonical</div>
          </div>
        </div>

        {/* ALREADY REGISTERED STATE */}
        {state === "REGISTERED_HUMAN_BACKED" && (
          <div className="py-6 px-4 text-center space-y-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-300">Human-backed ✓</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
                This agent wallet is officially registered in canonical AgentBook on World Chain. It is recognized as backed by a verified human.
              </p>
            </div>

            {txHash && (
              <div className="pt-2">
                <a
                  href={`https://worldscan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 underline underline-offset-4 transition"
                >
                  <span>View Registration Transaction</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            <div className="pt-3">
              <button
                onClick={() => {
                  clearPolling();
                  onClose();
                }}
                className="px-5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* NOT CHECKED / LOADING STATE */}
        {state === "NOT_CHECKED" && (
          <div className="py-12 text-center text-xs font-mono text-zinc-500 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-zinc-400" />
            <div>Verifying on-chain registration in AgentBook...</div>
          </div>
        )}

        {/* NOT REGISTERED / REGISTRATION WORKFLOW */}
        {state !== "REGISTERED_HUMAN_BACKED" && state !== "NOT_CHECKED" && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#12131a] border border-white/[0.05] text-xs">
              <button
                onClick={() => setActiveTab("app")}
                className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                  activeTab === "app"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>In-App World Verification</span>
              </button>
              <button
                onClick={() => setActiveTab("cli")}
                className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                  activeTab === "cli"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>CLI Option</span>
              </button>
            </div>

            {/* TAB 1: IN-APP WORLD ID BRIDGE */}
            {activeTab === "app" && (
              <div className="space-y-4">
                {state === "NOT_REGISTERED" && (
                  <div className="py-6 text-center space-y-4 rounded-xl bg-zinc-900/40 border border-white/[0.04]">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400">
                      <QrCode className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-zinc-200">Register with World ID</h4>
                      <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                        Generates a cryptographic registration request bound to this agent address and the current on-chain nonce.
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={handleStartInAppRegistration}
                        className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition active:scale-[0.98] inline-flex items-center gap-2"
                      >
                        <span>Register with World</span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-950" />
                      </button>
                    </div>
                  </div>
                )}

                {state === "INITIALIZING_BRIDGE" && (
                  <div className="py-12 text-center text-xs font-mono text-zinc-500 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400" />
                    <div>Fetching on-chain nonce & initializing World ID session...</div>
                  </div>
                )}

                {state === "WAITING_FOR_WORLD_APP" && qrCodeDataUrl && (
                  <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/[0.06] text-center space-y-3.5">
                    <div className="inline-block p-3 rounded-2xl bg-white shadow-xl mx-auto">
                      <img
                        src={qrCodeDataUrl}
                        alt="World ID Verification QR"
                        className="w-48 h-48 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Waiting for World App...</span>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        Scan this QR code with the World App on your mobile device
                      </p>
                    </div>

                    {connectorURI && (
                      <div className="pt-1">
                        <a
                          href={connectorURI}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/[0.06] transition"
                        >
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                          <span>Open in World App (Mobile)</span>
                        </a>
                      </div>
                    )}

                    {nonce && (
                      <div className="text-[10px] font-mono text-zinc-600">
                        Contract Nonce: {nonce} • Contract: 0xA23a...44dA
                      </div>
                    )}
                  </div>
                )}

                {state === "SUBMITTING_AGENTBOOK" && (
                  <div className="py-10 text-center space-y-3 rounded-xl bg-zinc-900/50 border border-white/[0.06]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-white">World ID Verified</h4>
                      <p className="text-[11px] text-zinc-400">
                        Submitting AgentBook registration transaction to World Chain...
                      </p>
                    </div>
                  </div>
                )}

                {state === "REGISTRATION_FAILED" && (
                  <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 text-center space-y-3">
                    <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
                    <div>
                      <h4 className="text-xs font-semibold text-rose-300">Registration Failed</h4>
                      <p className="text-[11px] text-rose-400/80 mt-1">
                        {errorMessage || "Unable to complete World ID verification."}
                      </p>
                    </div>
                    <button
                      onClick={handleStartInAppRegistration}
                      className="px-4 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 text-xs font-medium border border-rose-500/30 transition"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CLI OPTION */}
            {activeTab === "cli" && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/[0.05] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>CLI Registration Command</span>
                    <button
                      onClick={handleCopyRegister}
                      className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
                    >
                      {copiedRegister ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedRegister ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap select-all">
                    {registerCommand}
                  </pre>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Runs the official AgentKit CLI, binds to the agent address, and relays to World Chain.
                  </p>
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Registered externally?</span>
                  <button
                    onClick={handleCheckOnChain}
                    disabled={isCheckingOnChain}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/[0.06] transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingOnChain ? "animate-spin" : ""}`} />
                    <span>{isCheckingOnChain ? "Checking..." : "Check On-Chain Status"}</span>
                  </button>
                </div>

                {errorMessage && (
                  <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/20 text-rose-300 text-xs">
                    {errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-white/[0.05] text-xs text-zinc-500">
          <span>AgentBook: 0xA23a...44dA</span>
          <button
            onClick={() => {
              clearPolling();
              onClose();
            }}
            className="text-zinc-400 hover:text-zinc-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
