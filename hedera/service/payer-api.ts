/**
 * Float's Hedera payer, over HTTP.
 *
 * The rail already knows how to buy something on Hedera - quote the 402, check
 * the agent's USDC on the Mirror Node, and if it is short, park a dated
 * repayment on consensus before Float is out of pocket. That lived in a CLI
 * script, which meant the frontend could show the Arc rail and only talk about
 * this one.
 *
 * This is deliberately a separate process from the web app rather than an
 * import into it. The Hedera credentials live in the repo-root .env and the SDK
 * is heavy; copying six keys into web/.env to avoid one small service would be
 * the worse trade.
 *
 *   npm run hedera:payer
 */
import express from "express";

/**
 * This service is mechanism, not policy. It knows how to buy something on
 * Hedera; it does not know whose credit line is being spent, and it must not be
 * the thing deciding. The web app owns that - it resolves the human, their
 * headroom and their agent's mandate, then calls in here.
 *
 * So the only question at this door is whether the caller is that app. Left
 * open, anyone who could reach the port could spend the facility.
 */
const PAYER_SECRET = process.env.FLOAT_PAYER_SECRET;

import { payForResource } from "../agent/payer";
import { settleEarly } from "../src/scheduled";
import { append } from "../src/hcs";
import { liveRepayments, findParked, markSettled, recordParked } from "./scheduleStore";
import {
  agent,
  borrower,
  optionalTopicId,
  hashscanAccount,
  hashscanSchedule,
  hashscanTx,
} from "../src/config";

const PORT = Number(process.env.HEDERA_PAYER_PORT || 4023);
const SERVICE = process.env.HEDERA_SERVICE_URL || "http://localhost:4021";

const app = express();

app.use((req, res, next) => {
  if (!PAYER_SECRET) {
    return res.status(500).json({
      success: false,
      error: "FLOAT_PAYER_SECRET is not set; refusing to serve an unauthenticated payer.",
    });
  }
  if (req.headers["x-float-payer-secret"] !== PAYER_SECRET) {
    return res.status(401).json({ success: false, error: "Not authorised to spend the facility." });
  }
  next();
});
app.use(express.json());

/** Whether this rail can actually be used, so the UI can say so honestly. */
app.get("/status", async (_req, res) => {
  const configured = Boolean(process.env.HEDERA_AGENT_ID && process.env.HEDERA_AGENT_KEY);
  let sellerUp = false;
  try {
    const r = await fetch(`${SERVICE}/`, { signal: AbortSignal.timeout(2500) });
    sellerUp = r.ok;
  } catch {
    sellerUp = false;
  }

  const a = configured ? agent() : null;
  res.json({
    rail: "hedera",
    configured,
    sellerUp,
    service: SERVICE,
    agentId: a?.id ?? null,
    agentLink: a ? hashscanAccount(a.id) : null,
  });
});

/** What the rail sells. Metered, so the price is a function of the request. */
app.get("/catalogue", (_req, res) => {
  res.json({
    base: SERVICE,
    metered: true,
    resources: [
      { path: "/risk?records=1", price: 0.005, title: "Risk record", artifact: "json" },
      { path: "/risk?records=100", price: 0.5, title: "Risk feed · 100", artifact: "json" },
      { path: "/risk?records=400", price: 2.0, title: "Risk feed · 400", artifact: "json" },
    ],
  });
});

app.post("/pay", async (req, res) => {
  const url = String(req.body?.url || "");
  if (!url) return res.status(400).json({ error: "Missing url" });

  // How much credit the caller's human actually has left, decided on the Arc
  // side where the facility lives. Passed in rather than looked up here: this
  // process has no notion of World identity, and guessing would be worse than
  // asking.
  const maxCreditUsd =
    req.body?.maxCreditUsd === undefined ? undefined : Number(req.body.maxCreditUsd);

  try {
    const receipt = await payForResource(url, { maxCreditUsd });

    // Index the obligation so it can be found and cancelled later. Without
    // this the schedule id exists only in a log line, and settling early is
    // impossible - the cheque stays parked and fires anyway.
    if (receipt.scheduledRepayment) {
      recordParked({
        scheduleId: receipt.scheduledRepayment.scheduleId,
        borrowerId: process.env.HEDERA_BORROWER_ID || "",
        amountUsd: Number(receipt.scheduledRepayment.amount),
        dueAt: receipt.scheduledRepayment.dueAt,
        resource: url,
      });
    }

    res.json({
      success: true,
      ...receipt,
      links: {
        transaction: receipt.transactionId ? hashscanTx(receipt.transactionId) : null,
        schedule: receipt.scheduledRepayment
          ? hashscanSchedule(receipt.scheduledRepayment.scheduleId)
          : null,
      },
    });
  } catch (err: any) {
    console.error("[HederaPayer]", err?.message || err);
    res.status(400).json({ success: false, error: err?.message || "Payment failed" });
  }
});

/** Obligations currently parked on consensus. */
app.get("/schedules", (_req, res) => {
  const rows = liveRepayments();
  res.json({
    schedules: rows.map((r) => ({
      ...r,
      link: hashscanSchedule(r.scheduleId),
      dueInMs: new Date(r.dueAt).getTime() - Date.now(),
    })),
    totalUsd: rows.reduce((n, r) => n + r.amountUsd, 0),
  });
});

/**
 * Settle a parked repayment now instead of on its date.
 *
 * Paying early used to mean paying twice: nothing cancelled the schedule, so it
 * fired regardless and took the money a second time. The transfer runs first
 * and the schedule is deleted only once it has landed - the other order would
 * discharge a debt that was never collected.
 */
app.post("/repay", async (req, res) => {
  const scheduleId = String(req.body?.scheduleId || "");
  const parked = scheduleId ? findParked(scheduleId) : undefined;

  if (!parked) return res.status(404).json({ success: false, error: "No such parked repayment." });
  if (parked.status !== "live") {
    return res.status(409).json({ success: false, error: `Already ${parked.status}.` });
  }

  try {
    const result = await settleEarly({
      borrower: borrower(),
      amount: parked.amountUsd.toFixed(6),
      scheduleId,
    });

    markSettled(scheduleId, "settled", result.transactionId);

    const topic = optionalTopicId();
    if (topic) {
      try {
        await append(topic, {
          kind: "repayment",
          human: parked.borrowerId,
          amount: parked.amountUsd.toFixed(6),
          scheduleId,
          transactionId: result.transactionId,
        });
      } catch {
        // The trail is an audit record; a failed write must not undo a payment.
      }
    }

    res.json({
      success: true,
      ...result,
      amountUsd: parked.amountUsd,
      links: { transaction: hashscanTx(result.transactionId) },
    });
  } catch (err: any) {
    console.error("[HederaPayer] early repayment:", err?.message || err);
    res.status(400).json({ success: false, error: err?.message || "Early repayment failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Float Hedera payer on http://localhost:${PORT} -> seller ${SERVICE}`);
});
