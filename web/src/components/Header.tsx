"use client";

import React from "react";
import { LogOut, Terminal, Plus } from "lucide-react";
import { Wordmark, short } from "./ui";
import type { Rail } from "@/lib/rails";

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
    <div className="max-w-[1200px] mx-auto h-full px-6 sm:px-10 flex items-center justify-between gap-4">
      <div className="flex items-center gap-5 sm:gap-7">
        <Wordmark />

        {/* Which rail settles a payment. Arc keeps the debt ledger either way;
            this chooses where the money actually moves. */}
        <div className="hidden sm:flex items-center">
          <button
            onClick={() => onRailChange("arc")}
            className="btn"
            data-on={rail === "arc"}
            style={
              rail === "arc"
                ? { borderColor: "var(--ink)", background: "var(--ink)", color: "var(--paper)" }
                : undefined
            }
            title="Settle over Circle Gateway on Arc"
          >
            Arc
          </button>
          <button
            onClick={() => hederaReady && onRailChange("hedera")}
            disabled={!hederaReady}
            className="btn"
            data-on={rail === "hedera"}
            style={{
              marginLeft: -1,
              ...(rail === "hedera"
                ? { borderColor: "var(--ink)", background: "var(--ink)", color: "var(--paper)" }
                : {}),
            }}
            title={
              hederaReady
                ? "Settle over Blocky402 on Hedera, with a dated repayment on consensus"
                : "Hedera rail is not running - start it with npm run hedera:payer"
            }
          >
            Hedera
          </button>
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
