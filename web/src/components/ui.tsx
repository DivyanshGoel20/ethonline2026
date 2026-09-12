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

/**
 * The drawn meniscus.
 *
 * Two layers at different periods and speeds, so the surface reads as swell
 * rather than as a bar with a wobbly edge. Each layer carries an even number
 * of identical periods, because the drift animation slides it by exactly half
 * its width and an odd count would visibly jump on the loop.
 */
export const Wave: React.FC = () => (
  <>
    <div className="wave wave-a">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path
          d="M0,32 C100,4 200,60 300,32 C400,4 500,60 600,32 C700,4 800,60 900,32 C1000,4 1100,60 1200,32 L1200,60 L0,60 Z"
          fill="currentColor"
        />
      </svg>
    </div>
    <div className="wave wave-b">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path
          d="M0,28 C150,0 450,56 600,28 C750,0 1050,56 1200,28 L1200,60 L0,60 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  </>
);

/**
 * A boat on the line.
 *
 * Sits inside the water element, so it rides the surface for free: when the
 * facility is drawn down the water rises and the boat rises with it, on the
 * same easing.
 */
export const Boat: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = "",
  style,
}) => (
  <div className={`boat ${className}`} style={style} aria-hidden="true">
    <svg width="54" height="57" viewBox="0 0 34 36" fill="none">
      <line x1="17" y1="3" x2="17" y2="25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M18.6 6 L18.6 23 L29 23 Z" fill="currentColor" />
      <path d="M15.4 9 L7.5 23 L15.4 23 Z" fill="currentColor" opacity="0.75" />
      <path d="M1.5 25 Q17 35 32.5 25 Z" fill="currentColor" />
    </svg>
  </div>
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
