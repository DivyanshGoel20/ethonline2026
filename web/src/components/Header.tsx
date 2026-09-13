"use client";

import React from "react";
import { LogOut, Terminal, Plus } from "lucide-react";
import { Wordmark, short } from "./ui";
import { WalletButton } from "./WalletButton";
import type { Rail } from "@/lib/rails";
import { RAIL_FACTS } from "@/lib/rails";

interface HeaderProps {
  onOpenAddAgent: () => void;
  onOpenApiDocs: () => void;
  onSignOut: () => void;
  isWorldVerified: boolean;
  nullifierHash: string | null;
  activeAgentsCount: number;
  rail: Rail;
  onRailChange: (rail: Rail) => void;
  hederaReady: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddAgent,
  onOpenApiDocs,
  onSignOut,
  isWorldVerified,
  nullifierHash,
  rail,
  onRailChange,
  hederaReady,
}) => (
  <header className="rail sticky top-0 z-30">
    {/* The rail's own colour, full width, above everything. */}
    <div className="rail-band" aria-hidden="true" />
    <div className="rail-row max-w-[1200px] mx-auto px-6 sm:px-10 flex items-center justify-between gap-4">
      <div className="flex items-center gap-5 sm:gap-7">
        <Wordmark />

        {/* Which rail settles a payment. Arc keeps the debt ledger either way;
            this chooses the network, the x402 service and how money moves.
            Labelled rather than lettered, because "Arc" and "Hedera" alone do
            not tell anyone these are two different services. */}
        <div className="rail-switch hidden sm:flex items-stretch" role="group" aria-label="Settlement rail">
          {(["arc", "hedera"] as Rail[]).map((r) => {
            const on = rail === r;
            const off = r === "hedera" && !hederaReady;
            const f = RAIL_FACTS[r];
            return (
              <button
                key={r}
                onClick={() => !off && onRailChange(r)}
                disabled={off}
                className="rail-seg"
                data-on={on}
                aria-pressed={on}
                title={
                  off
                    ? "Hedera rail is not running - start it with npm run hedera:payer"
                    : `${f.network} · ${f.resource} · settled through ${f.facilitator}, ${f.mechanism}`
                }
              >
                <span className="rail-seg-name">{RAIL_FACTS[r].network.split(" ")[0]}</span>
                <span className="rail-seg-sub">{off ? "offline" : f.facilitator}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-4">
        {isWorldVerified && (
          <span
            className="mn faint hidden md:inline"
            title={`World ID nullifier: ${nullifierHash ?? "verified"}`}
            style={{ fontSize: 9.5 }}
          >
            human {short(nullifierHash, 6, 4)}
          </span>
        )}

        <WalletButton />

        <button onClick={onOpenApiDocs} className="btn" title="Agent HTTP API">
          <Terminal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">API</span>
        </button>

        <button onClick={onOpenAddAgent} className="btn btn-strong">
          <Plus className="w-3.5 h-3.5" />
          <span>Add agent</span>
        </button>

        {isWorldVerified && (
          <button onClick={onSignOut} className="btn btn-icon" title="Sign out">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  </header>
);
