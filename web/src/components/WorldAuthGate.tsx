"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { selfieCheckLegacy } from "@worldcoin/idkit";
import type { RpContext, IDKitResult } from "@worldcoin/idkit";
import { Wave, Wordmark, ErrorNote } from "./ui";

const IDKitRequestWidget = dynamic(
  () => import("@worldcoin/idkit").then((mod) => mod.IDKitRequestWidget),
  { ssr: false }
);

interface WorldAuthGateProps {
  onVerified: (nullifierHash: string) => void;
}

/**
 * Entry.
 *
 * The whole product rests on one claim, so the screen makes exactly that
 * claim and offers exactly one action. The waterline sits at zero until a
 * human is behind the facility.
 */
export const WorldAuthGate: React.FC<WorldAuthGateProps> = ({ onVerified }) => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [isLoadingRp, setIsLoadingRp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appId = (process.env.NEXT_PUBLIC_WORLD_APP_ID ||
    "app_9af54079c0ae44169e8a21df561ec2d3") as `app_${string}`;
  const action = process.env.NEXT_PUBLIC_WORLD_ACTION || "float-human-verify";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpenWidget = async () => {
    setIsLoadingRp(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/world-rp-context");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not start a World Selfie Check session");
      }
      setRpContext(await res.json());
      setIsOpen(true);
    } catch (err: any) {
      console.error("[WorldAuthGate] Session error:", err);
      setError(err.message || "Could not start a World Selfie Check session");
    } finally {
      setIsLoadingRp(false);
    }
  };

  const verifiedNullifierRef = React.useRef<string | null>(null);

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
        throw new Error(data.error || "World Selfie Check rejected the proof.");
      }
      if (data.nullifierHash) verifiedNullifierRef.current = data.nullifierHash;
    } catch (err: any) {
      console.error("[WorldAuthGate] Verify error:", err);
      setError(err.message || "Could not verify the World ID proof");
      throw err;
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSuccess = (result: IDKitResult) => {
    const nullifier =
      verifiedNullifierRef.current ||
      (result as any).responses?.[0]?.nullifier ||
      (result as any).nullifier ||
      (result as any).nullifier_hash;

    if (!nullifier) {
      setError("Verification returned no nullifier, so no facility can be opened.");
      return;
    }
    onVerified(nullifier);
  };

  const busy = isLoadingRp || isVerifying;

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <header className="rail">
        <div className="max-w-[1200px] mx-auto h-full px-6 sm:px-10 flex items-center">
          <Wordmark />
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-[1200px] w-full mx-auto px-6 sm:px-10 py-16">
          <h1
            className="serif"
            style={{
              fontSize: "clamp(40px, 7vw, 86px)",
              lineHeight: 1.0,
              letterSpacing: "-0.028em",
              maxWidth: "15ch",
              textWrap: "pretty",
            }}
          >
            An agent can hold the money. Only a human can hold the{" "}
            <span style={{ color: "var(--sea)" }}>debt</span>.
          </h1>

          <p className="dim mt-7" style={{ fontSize: 17, lineHeight: 1.6, maxWidth: "50ch" }}>
            Float opens a USDC credit line against a verified human, so their agents can keep paying
            when a bill lands before the balance does.
          </p>

          <div className="flex flex-wrap items-center gap-6 mt-11">
            <button onClick={handleOpenWidget} disabled={busy} className="btn btn-solid btn-lg">
              {isLoadingRp
                ? "Starting session…"
                : isVerifying
                ? "Checking proof…"
                : "Verify with World Selfie Check"}
            </button>
            <span className="mn faint" style={{ fontSize: 10, lineHeight: 1.8 }}>
              One human, one facility.
              <br />
              Nullifier-bound &mdash; no wallet needed to start.
            </span>
          </div>

          {error && (
            <div className="mt-8" style={{ maxWidth: "56ch" }}>
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>
      </main>

      {/* the line, at zero */}
      <div className="relative shrink-0" style={{ height: 66, background: "var(--sea)", color: "var(--sea)" }}>
        <Wave />
        <div
          className="absolute inset-x-0 bottom-4 max-w-[1200px] mx-auto px-6 sm:px-10 flex flex-wrap justify-between gap-3"
          style={{ color: "var(--paper)" }}
        >
          <span className="mn" style={{ fontSize: 9.5, opacity: 0.82 }}>
            $0.00 drawn of $10.00
          </span>
          <span className="mn" style={{ fontSize: 9.5, opacity: 0.82 }}>
            Arc &middot; World &middot; The Graph
          </span>
        </div>
      </div>

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
            console.error("[WorldAuthGate] IDKit error:", errCode);
            setError(`World ID verification error: ${errCode}`);
          }}
        />
      )}
    </div>
  );
};
