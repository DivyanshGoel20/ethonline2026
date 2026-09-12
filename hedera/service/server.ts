/**
 * Float Risk Feed - an x402-gated service on Hedera, settled through Blocky402.
 *
 * Float lends to agents, which means Float has to price agent risk, which means
 * somebody has to sell that signal. This is that service: a credit-risk feed
 * for autonomous agents, priced by the record rather than by the seat.
 *
 * It is metered, not flat-rate. Ask for one agent's score and you pay for one;
 * ask for twenty and the 402 quotes twenty. That is the whole argument for
 * machine payments - a subscription cannot price a query the buyer decides the
 * shape of at request time.
 *
 * Settlement is the Hedera exact scheme: the caller sends a partially-signed
 * TransferTransaction, Blocky402 counter-signs as fee payer and submits it. The
 * caller never holds HBAR for gas.
 *
 *   npm run hedera:service
 */
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";

import { FACILITATOR_URL, NETWORK, USDC, USDC_DECIMALS, seller } from "../src/config";
import { riskFor, universe } from "./risk";

const PORT = Number(process.env.HEDERA_SERVICE_PORT || 4021);

/** Per-record price. A one-record call costs this; a twenty-record call costs twenty times it. */
const PRICE_PER_RECORD = 0.005;
const MAX_RECORDS = 25;

/**
 * Reads the meter off the request.
 *
 * Via the adapter, not `context.path`: that is the matched route ("/risk") with
 * the query string already stripped, so pricing off it silently quotes every
 * call as a single record no matter what was asked for.
 */
function recordsRequested(context: { adapter?: { getQueryParam?: (k: string) => string | undefined } }): number {
  const raw = context.adapter?.getQueryParam?.("records");
  return clampRecords(raw);
}

function clampRecords(raw: string | string[] | undefined): number {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(first ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_RECORDS);
}

const money = (n: number) => `$${n.toFixed(3)}`;

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

const resourceServer = new x402ResourceServer(facilitator).register(
  "hedera:*",
  new ExactHederaScheme({
    defaultAssets: {
      [NETWORK]: { asset: USDC, decimals: USDC_DECIMALS },
    },
  })
);

const app = express();

app.get("/", (_req, res) => {
  res.json({
    service: "Float Risk Feed",
    network: NETWORK,
    settlement: "x402 exact scheme via Blocky402",
    facilitator: FACILITATOR_URL,
    asset: { token: USDC, symbol: "USDC", decimals: USDC_DECIMALS },
    pricing: {
      model: "per-record",
      perRecord: money(PRICE_PER_RECORD),
      maxRecords: MAX_RECORDS,
      example: `GET /risk?records=5 costs ${money(PRICE_PER_RECORD * 5)}`,
    },
    endpoints: { free: ["/", "/catalog"], paid: ["/risk?records=N"] },
  });
});

/** Free, so an agent can discover what is for sale before paying for any of it. */
app.get("/catalog", (_req, res) => {
  res.json({
    records: universe().length,
    fields: ["agentId", "score", "band", "signals", "observedAt"],
    pricePerRecord: money(PRICE_PER_RECORD),
    payTo: seller().id,
    network: NETWORK,
  });
});

app.use(
  paymentMiddleware(
    {
      "GET /risk": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          payTo: seller().id,
          // Metering lives here: the quote in the 402 is computed from the
          // request, so the buyer is billed for what they actually asked for.
          price: (context) => money(PRICE_PER_RECORD * recordsRequested(context as any)),
        },
        description: "Credit-risk scores for autonomous agents, priced per record",
        serviceName: "Float Risk Feed",
        mimeType: "application/json",
        tags: ["credit", "agents", "risk"],
        unpaidResponseBody: (context) => {
          const n = recordsRequested(context as any);
          return {
            contentType: "application/json",
            body: {
              preview: `${n} record${n === 1 ? "" : "s"} available`,
              price: money(PRICE_PER_RECORD * n),
              network: NETWORK,
              asset: USDC,
            },
          };
        },
      },
    },
    resourceServer
  )
);

app.get("/risk", (req, res) => {
  const n = clampRecords(req.query.records as string | undefined);
  res.json({
    records: riskFor(n),
    meta: { records: n, pricePerRecord: money(PRICE_PER_RECORD), charged: money(PRICE_PER_RECORD * n) },
  });
});

app.listen(PORT, () => {
  console.log(`Float Risk Feed  http://localhost:${PORT}`);
  console.log(`  network     ${NETWORK}`);
  console.log(`  facilitator ${FACILITATOR_URL}`);
  console.log(`  payTo       ${seller().id}`);
  console.log(`  price       ${money(PRICE_PER_RECORD)} per record, up to ${MAX_RECORDS}`);
});
