"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Camera, ShieldCheck, AlertCircle, ArrowRight, Lock, Sparkles } from "lucide-react";
import { selfieCheckLegacy } from "@worldcoin/idkit";
import type { RpContext, IDKitResult } from "@worldcoin/idkit";

const IDKitRequestWidget = dynamic(
  () => import("@worldcoin/idkit").then((mod) => mod.IDKitRequestWidget),
  { ssr: false }
);

interface WorldAuthGateProps {
  onVerified: (nullifierHash: string) => void;
}

export const WorldAuthGate: React.FC<WorldAuthGateProps> = ({ onVerified }) => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [isLoadingRp, setIsLoadingRp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appId = (process.env.NEXT_PUBLIC_WORLD_APP_ID || "app_9af54079c0ae44169e8a21df561ec2d3") as `app_${string}`;
  const action = process.env.NEXT_PUBLIC_WORLD_ACTION || "float-human-verify";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch cryptographic RP context before opening widget
  const handleOpenWidget = async () => {
    setIsLoadingRp(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/world-rp-context");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate World ID 4.0 session signature");
      }
      const data: RpContext = await res.json();
      setRpContext(data);
      setIsOpen(true);
    } catch (err: any) {
      console.error("[WorldAuthGate] Session error:", err);
      setError(err.message || "Failed to initialize Selfie Check session");
    } finally {
      setIsLoadingRp(false);
    }
  };

  const verifiedNullifierRef = React.useRef<string | null>(null);

  // Called by IDKit when World App returns the zero-knowledge proof
  const handleVerify = async (result: IDKitResult) => {
    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/world-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });

      const data = await res.json();
      if (!res.ok || !data.verified) {
        throw new Error(data.error || "World Selfie Check verification was rejected.");
      }

      if (data.nullifierHash) {
        verifiedNullifierRef.current = data.nullifierHash;
        console.log("[WorldAuthGate] Verified unique nullifier:", data.nullifierHash);
      }
    } catch (err: any) {
      console.error("[WorldAuthGate] Verify error:", err);
      setError(err.message || "Failed to verify World ID proof");
      throw err;
    } finally {
      setIsVerifying(false);
    }
  };

  // Called on successful verification completion
  const handleSuccess = (result: IDKitResult) => {
    const nullifier =
      verifiedNullifierRef.current ||
      (result as any).responses?.[0]?.nullifier ||
      (result as any).nullifier ||
      (result as any).nullifier_hash ||
      `verified_${Date.now()}`;
    console.log("[WorldAuthGate] Logging in with World ID nullifier:", nullifier);
    onVerified(nullifier);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#09090b] text-zinc-100 bg-grid-pattern">
      {/* Minimal Top Header */}
      <header className="border-b border-white/[0.08] bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center font-mono font-black text-xs text-zinc-950 shadow-sm">
              FL
            </div>
            <span className="font-semibold text-sm tracking-wide text-zinc-100">FLOAT</span>
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
              // CREDIT PROTOCOL
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <Lock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Restricted Access</span>
          </div>
        </div>
      </header>

      {/* Main Gatekeeper Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-[#111115] border border-white/[0.08] rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Badge & Title */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-white/[0.08] text-xs font-mono text-zinc-400 mb-3">
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>World Selfie Check (Beta)</span>
              <Sparkles className="w-3 h-3 text-amber-400 ml-0.5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Human Operator Verification
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              Float grants controlled USDC credit facilities to autonomous AI agents. To prevent automated Sybil exploits, you must verify your live human biometric presence via World Selfie Check.
            </p>
          </div>

          {/* Key verification properties */}
          <div className="space-y-2.5 p-4 rounded-xl bg-zinc-950 border border-white/[0.04] text-xs font-mono text-zinc-400">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-zinc-200 font-medium">1:1 Biometric Camera Liveness</span>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Facial similarity and 3D liveness performed securely in your World App.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1 border-t border-white/[0.04]">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-zinc-200 font-medium">Zero-Knowledge Privacy</span>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  No biometric photos or identities are stored or transmitted. Float only receives an anonymous zero-knowledge proof.
                </p>
              </div>
            </div>
          </div>

          {/* Trigger Button */}
          <div>
            <button
              type="button"
              onClick={handleOpenWidget}
              disabled={isVerifying || isLoadingRp}
              className="w-full py-3 px-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-semibold transition shadow-md flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              <span>
                {isLoadingRp
                  ? "Initializing Selfie Session..."
                  : isVerifying
                  ? "Verifying Selfie Proof..."
                  : "Verify with World App (Selfie Check)"}
              </span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/20 text-xs font-mono text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Configuration Footer */}
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-2 border-t border-white/[0.06]">
            <span>Credential: Selfie (Beta)</span>
            <span>Action: {action}</span>
          </div>
        </div>
      </main>

      {/* IDKit v4 Request Widget */}
      {mounted && rpContext && (
        <IDKitRequestWidget
          open={isOpen}
          onOpenChange={setIsOpen}
          app_id={appId}
          action={action}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={selfieCheckLegacy()}
          handleVerify={handleVerify}
          onSuccess={handleSuccess}
          onError={(errCode) => {
            console.error("[WorldAuthGate] IDKit Error:", errCode);
            setError(`World ID verification error: ${errCode}`);
          }}
        />
      )}

      {/* Minimal Footer */}
      <footer className="py-4 border-t border-white/[0.06] text-center text-xs font-mono text-zinc-600">
        Float Protocol — Powered by World ID Selfie Check & Arc USDC
      </footer>
    </div>
  );
};
