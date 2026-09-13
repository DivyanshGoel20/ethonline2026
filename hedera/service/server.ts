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

import { FACILITATOR_URL, NETWORK, USDC, USDC_DECIMALS, optionalTopicId, seller } from "../src/config";
import { uaidForAgent, type AgentFacts } from "../src/hcs14";
import { riskFor, universe } from "./risk";

const PORT = Number(process.env.HEDERA_SERVICE_PORT || 4021);

/** Per-record price. A one-record call costs this; a twenty-record call costs twenty times it. */
const PRICE_PER_RECORD = 0.005;
/**
 * Raised from 25 so the meter can reach a price worth borrowing for.
 *
 * A ceiling of $0.125 could never exercise the interesting path: a charge that
 * is a real fraction of a ten dollar line, where Float has to decide whether
 * the headroom is there. At 400 records a single call quotes $2.00.
 */
const MAX_RECORDS = 400;

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

/**
 * This service's own identity, under HCS-14.
 *
 * Derived rather than assigned: the same facts produce the same UAID from
 * anywhere, so another agent that has only seen the manifest can confirm the
 * id belongs to the service it describes. `registry: "self"` is the honest
 * value - Float is not listed in a shared registry, and claiming one it is not
 * in would make the identifier a lie in a machine-readable format.
 */
const SERVICE_FACTS: AgentFacts = {
  registry: "self",
  name: "Float Risk Feed",
  version: "1.0.0",
  protocol: "x402",
  // CAIP-10, which is what the standard prefers for a native id.
  nativeId: `hedera:testnet:${seller().id}`,
  // 0 = data provision, 17 = financial/risk signal, per the HCS-14 skill codes.
  skills: [0, 17],
};

export const SERVICE_UAID = uaidForAgent(SERVICE_FACTS, { domain: process.env.HEDERA_SERVICE_DOMAIN });

const app = express();

/**
 * The discovery manifest.
 *
 * Free and unauthenticated on purpose: an agent cannot decide whether to buy
 * from a service it cannot read first. Everything needed to complete a purchase
 * without a human reading documentation is here - who to pay, on what network,
 * in which asset, through which facilitator, at what price, and how the price
 * varies with the request.
 */
app.get("/.well-known/agent", (_req, res) => {
  const topic = optionalTopicId();
  res.json({
    uaid: SERVICE_UAID,
    identity: { standard: "HCS-14", target: "aid", facts: SERVICE_FACTS },
    service: SERVICE_FACTS.name,
    version: SERVICE_FACTS.version,
    payment: {
      protocol: "x402",
      scheme: "exact",
      network: NETWORK,
      facilitator: FACILITATOR_URL,
      asset: { token: USDC, symbol: "USDC", decimals: USDC_DECIMALS },
      payTo: seller().id,
      pricing: {
        model: "per-record",
        perRecordUsd: PRICE_PER_RECORD,
        maxRecords: MAX_RECORDS,
        formula: "records * perRecordUsd",
      },
    },
    resources: [
      {
        path: "/risk",
        method: "GET",
        params: { records: `1-${MAX_RECORDS}` },
        priced: "per-record",
        description: "Credit risk records for autonomous agents, priced by the record.",
      },
    ],
    auditTrail: topic
      ? { standard: "HCS", topicId: topic, mirror: `https://hashscan.io/testnet/topic/${topic}` }
      : null,
  });
});

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
    uaid: SERVICE_UAID,
    endpoints: { free: ["/", "/catalog", "/.well-known/agent"], paid: ["/risk?records=N"] },
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
