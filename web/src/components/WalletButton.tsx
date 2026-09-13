"use client";

import React from "react";
import { Wallet as WalletIcon, AlertTriangle } from "lucide-react";
import { short } from "./ui";
import { useWallet } from "@/lib/useWallet";

/**
 * The connect step that did not exist.
 *
 * Settling from a personal wallet is a real choice with real money behind it,
 * and until there was somewhere to make it the app made it silently. Three
 * states, because they mean different things: not connected, connected but on
 * the wrong chain, and ready. The middle one is the reason this is a button
 * rather than a label - it is fixable, and the person has to be told.
 */
export const WalletButton: React.FC = () => {
  const { available, address, onArc, connecting, error, connect, switchToArc } = useWallet();

  if (!available) return null;

  if (!address) {
    return (
      <button
        onClick={() => void connect()}
        disabled={connecting}
        className="btn"
        title="Connect a wallet to settle loans from it"
      >
        <WalletIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{connecting ? "Connecting…" : "Connect wallet"}</span>
      </button>
    );
  }

  if (!onArc) {
    return (
      <button
        onClick={() => void switchToArc()}
        className="btn"
        title="This wallet is on another network. Switch it to Arc testnet."
        style={{ borderColor: "var(--flare)", color: "var(--flare)" }}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Wrong network</span>
      </button>
    );
  }

  return (
    <span
      className="mn faint hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5"
      style={{ fontSize: 10, border: "1px solid var(--hair)" }}
      title={`${address} on Arc testnet${error ? ` — ${error}` : ""}`}
    >
      <span style={{ width: 5, height: 5, background: "var(--sea)" }} />
      {short(address)}
    </span>
  );
};
