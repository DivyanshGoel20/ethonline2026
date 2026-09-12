"use client";

import React from "react";
import { CreditStats as CreditStatsType } from "@/types";
import { Wave, Boat, Label, usd } from "./ui";

const FACILITY_CONTRACT = "0xAa2d23bAC7b6f9b4ca2737252F924b3F485E0686";
const TICKS = [0, 25, 50, 75, 100];

interface CreditStatsProps {
  stats: CreditStatsType;
  facilityLimit?: number;
}

/**
 * The waterline.
 *
 * The available-credit figure is positioned against the surface of the water,
 * not against the frame, so drawing on the line visibly pushes it up. The
 * drawn figure lives inside the water and fades out when there is too little
 * water to hold it. The scale sits outside the tank, as a ruler beside it, so
 * the water can run the full width.
 */
export const CreditStats: React.FC<CreditStatsProps> = ({ stats, facilityLimit = 10 }) => {
  const drawn = stats.totalOutstandingDebt;
  const available = Math.max(0, facilityLimit - drawn);
  const util = Math.max(0, Math.min(100, (drawn / facilityLimit) * 100));

  // Keep the figure inside the tank once the water gets high.
  const rider = Math.min(util, 52);

  // The drawn figure lives in the water, so it can only live there while there
  // is enough water to contain it. Below that it rides with the available
  // figure instead of poking out through the surface.
  const deep = util >= 20;

  // The boat is 57px tall in a 260-310px tank, so it has to stop climbing well
  // before the water does or it sails out through the top of the frame.
  const boat = Math.min(util, 74);

  return (
    <section>
      <div className="flex items-stretch gap-3 sm:gap-4">
        <div className="tank flex-1 min-w-0 h-[260px] sm:h-[310px]">
          {/* gauge rules */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to top, transparent 0, transparent 30px, var(--band) 30px, var(--band) 31px)",
            }}
          />

          <div className="tank-sea" style={{ height: `${util.toFixed(2)}%` }}>
            <Wave />
            <div
              className="absolute left-7 sm:left-10 bottom-4 flex items-baseline gap-3 transition-opacity duration-500"
              style={{ color: "var(--paper)", opacity: deep ? 1 : 0 }}
            >
              <span
                className="mn"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  opacity: 0.72,
                }}
              >
                Drawn
              </span>
              <span className="serif" style={{ fontSize: "clamp(22px, 3.4vw, 28px)" }}>
                {usd(drawn)}
              </span>
            </div>
          </div>

          <Boat className="boat-tank" style={{ bottom: `calc(${boat.toFixed(2)}% + 2px)` }} />

          <div
            className="tank-rider left-7 sm:left-10"
            style={{ bottom: `calc(${rider.toFixed(2)}% + 22px)` }}
          >
            <Label className="mb-1">Available to draw</Label>
            <div
              className="serif"
              style={{ fontSize: "clamp(52px, 7vw, 86px)", lineHeight: 0.85, letterSpacing: "-0.03em" }}
            >
              {usd(available)}
            </div>
            {!deep && drawn > 0 && (
              <div className="mn faint mt-2.5" style={{ fontSize: 10 }}>
                {usd(drawn)} drawn
              </div>
            )}
          </div>
        </div>

        {/* the ruler. Hidden on a phone: it would cost a quarter of the tank
            to restate what the facility line under it already says. */}
        <div className="relative hidden sm:block sm:w-[76px] shrink-0">
          {TICKS.map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 flex items-center gap-2 translate-y-1/2"
              style={{ bottom: `${pct}%` }}
            >
              <span style={{ display: "block", width: 9, height: 1, background: "var(--ink3)" }} />
              <span className="mn faint" style={{ fontSize: 9 }}>
                {usd((facilityLimit * pct) / 100)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 mt-3.5">
        <span className="mn faint" style={{ fontSize: 9.5 }}>
          {usd(facilityLimit)} facility &middot; 1% origination &middot; 0.05% per day &middot; 7-day term
        </span>
        <a
          className="mn faint hover:text-[color:var(--ink)] transition-colors"
          style={{ fontSize: 9.5 }}
          href={`https://testnet.arcscan.app/address/${FACILITY_CONTRACT}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          0xAa2d&hellip;0686 &middot; Arc testnet
        </a>
      </div>
    </section>
  );
};
