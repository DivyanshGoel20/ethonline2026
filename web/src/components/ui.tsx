"use client";

import React from "react";
import { X } from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Shared primitives for the Waterline vocabulary.

   Appearance lives in globals.css; these exist so every surface agrees on
   the same anatomy — a modal is always a bordered paper sheet with a ruled
   header, a label is always the same mono micro-caps.
   ────────────────────────────────────────────────────────────────────────── */

export const Label: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className = "", style }) => (
  <div className={`lab ${className}`} style={style}>
    {children}
  </div>
);

export const Mono: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <span className={`mn ${className}`}>{children}</span>;

/** The drawn meniscus. Two offset paths so the surface never looks like a bar. */
export const Wave: React.FC = () => (
  <>
    <div className="wave wave-a">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none">
        <path
          d="M0,26 C100,10 200,40 300,26 C400,12 500,40 600,26 C700,10 800,40 900,26 C1000,12 1100,40 1200,26 L1200,40 L0,40 Z"
          fill="currentColor"
        />
      </svg>
    </div>
    <div className="wave wave-b">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none">
        <path
          d="M0,20 C150,38 250,6 400,20 C550,34 650,6 800,20 C950,34 1050,6 1200,20 L1200,40 L0,40 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  </>
);

export const Wordmark: React.FC<{ href?: string }> = () => (
  <div className="flex items-baseline gap-2.5">
    <span className="wordmark">float</span>
    <span className="wordmark-rule" />
  </div>
);

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Every modal in the app. Paper sheet, ruled header, hard shadow. */
export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  width = 520,
  children,
  footer,
}) => {
  if (!open) return null;

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet my-auto" style={{ maxWidth: width }}>
        <div
          className="flex items-start justify-between gap-6 px-6 py-5"
          style={{ borderBottom: "1px solid var(--ink)" }}
        >
          <div className="min-w-0">
            <h2 className="serif" style={{ fontSize: 27 }}>
              {title}
            </h2>
            {subtitle ? (
              <div className="mn faint mt-1.5" style={{ fontSize: 10 }}>
                {subtitle}
              </div>
            ) : null}
          </div>
          <button onClick={onClose} className="btn btn-icon shrink-0" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">{children}</div>

        {footer ? (
          <div
            className="px-6 py-4 flex items-center justify-end gap-2.5"
            style={{ borderTop: "1px solid var(--hair)", background: "var(--sunk)" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** A labelled input. */
export const Field: React.FC<{
  label: string;
  hint?: React.ReactNode;
  right?: React.ReactNode;
  suffix?: string;
  children: React.ReactNode;
}> = ({ label, hint, right, suffix, children }) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <Label>{label}</Label>
      {right}
    </div>
    <div className="relative">
      {children}
      {suffix ? (
        <span
          className="mn faint absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ fontSize: 10 }}
        >
          {suffix}
        </span>
      ) : null}
    </div>
    {hint ? (
      <div className="mn faint mt-2" style={{ fontSize: 9.5, lineHeight: 1.7 }}>
        {hint}
      </div>
    ) : null}
  </div>
);

/** One line of a key/value block. */
export const Kv: React.FC<{
  k: React.ReactNode;
  v: React.ReactNode;
  tone?: "ink" | "sea" | "flare" | "faint";
}> = ({ k, v, tone = "ink" }) => {
  const color =
    tone === "sea"
      ? "var(--sea)"
      : tone === "flare"
      ? "var(--flare)"
      : tone === "faint"
      ? "var(--ink3)"
      : "var(--ink)";

  return (
    <div className="kv">
      <span className="dim" style={{ fontSize: 13 }}>
        {k}
      </span>
      <span className="mn" style={{ fontSize: 12, color, textAlign: "right" }}>
        {v}
      </span>
    </div>
  );
};

export const ErrorNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="note note-bad" style={{ fontSize: 12.5 }}>
    {children}
  </div>
);

export const short = (a?: string | null, head = 6, tail = 4) =>
  a ? `${a.slice(0, head)}…${a.slice(-tail)}` : "";

export const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
