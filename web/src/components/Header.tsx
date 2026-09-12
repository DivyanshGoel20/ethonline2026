"use client";

import React from "react";
import { LogOut, Terminal, Plus } from "lucide-react";
import { Wordmark, short } from "./ui";

interface HeaderProps {
  onOpenAddAgent: () => void;
  onOpenApiDocs: () => void;
  onSignOut: () => void;
  isWorldVerified: boolean;
  nullifierHash: string | null;
  activeAgentsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddAgent,
  onOpenApiDocs,
  onSignOut,
  isWorldVerified,
  nullifierHash,
}) => (
  <header className="rail sticky top-0 z-30">
    <div className="max-w-[1200px] mx-auto h-full px-6 sm:px-10 flex items-center justify-between gap-4">
      <Wordmark />

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
