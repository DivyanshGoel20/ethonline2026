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
import { payForResource } from "../agent/payer";
import { agent, hashscanAccount, hashscanSchedule, hashscanTx } from "../src/config";

const PORT = Number(process.env.HEDERA_PAYER_PORT || 4023);
const SERVICE = process.env.HEDERA_SERVICE_URL || "http://localhost:4021";

const app = express();
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

  try {
    const receipt = await payForResource(url);
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

app.listen(PORT, () => {
  console.log(`Float Hedera payer on http://localhost:${PORT} -> seller ${SERVICE}`);
});
