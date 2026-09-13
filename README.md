# Float

> An undercollateralised credit line for autonomous agents.

An agent can hold money. Only a human can hold debt.

Float extends a USDC credit line to a human, verified once by World ID, and lets
their agents spend against it. When an agent hits a paywall it cannot afford,
Float pays on its behalf and records what is owed. The agent keeps working; the
human carries the liability, which is the only way undercollateralised credit
can work when agents are free to create.

---

## Two rails, one credit line

**Arc** is the ledger of record. Credit profiles, limits, drawdowns and
repayments live in a Foundry contract there, and a human's headroom is the
answer that contract gives.

**Hedera** is where value moves and where the obligation to return it is
enforced. An x402-gated service is settled through the Blocky402 facilitator,
and — the part only this ledger can do — the repayment is parked on consensus
with a date on it *before* Float is out of pocket.

```
                    World ID  ─── one human, one credit line
                        │
                        ▼
        ┌───────────────────────────────┐
        │ Arc testnet                   │   the debt ledger
        │ FloatCreditFacility           │   0x43bC32b6…642C4
        │ profiles · limits · drawdowns │
        └───────────────┬───────────────┘
                        │ headroom check, both rails
            ┌───────────┴───────────┐
            ▼                       ▼
    ┌───────────────┐       ┌──────────────────────────┐
    │ Arc           │       │ Hedera                   │
    │ Circle        │       │ x402 exact scheme        │
    │ Gateway       │       │ via Blocky402            │
    │ batching      │       │ HIP-423 dated repayment  │
    │               │       │ HCS audit trail          │
    └───────────────┘       └──────────────────────────┘
```

Both rails spend the **same** limit. A Hedera drawdown consumes Arc headroom and
is refused when it exceeds it, so the line cannot be drawn twice.

## The payment flow

1. An agent requests a metered resource and gets `402` with the requirements in
   the `PAYMENT-REQUIRED` header — amount, asset, `payTo`, facilitator.
2. Its own balance is read. Enough, and it pays for itself and owes nothing.
3. Short, and Float checks the human's remaining headroom on Arc. Over it, the
   request is refused before any money moves.
4. Within it, a repayment is scheduled on Hedera — signed once by the borrower,
   held by consensus until its date — and only then does Float settle with the
   seller.
5. The drawdown is recorded against the human, and every step is appended to an
   HCS topic anyone can read.

Repaying early deletes the parked transfer, because a schedule that fires after
the debt is gone charges twice.

## Layout

```text
contracts/          Foundry contracts for the Arc credit facility
web/                Next.js app: dashboard, agent APIs, both rails
hedera/             the Hedera rail — x402 service, payer, schedules, HCS
float-premium-api/  x402 resources on Arc, priced $0.01 / $1 / $5
agent-demo/         autonomous agent lifecycle runner
```

## Setup

```bash
npm install
cp .env.example .env          # Arc, World, Circle
cp hedera/.env.example .env   # or merge the Hedera block in
npm run hedera:setup          # provisions Hedera accounts + HCS topic
```

Then run the pieces you need:

```bash
npm run dev                                  # app on :3000
cd float-premium-api && PORT=4402 npx tsx server.ts   # Arc x402 resources
npm run hedera:service                       # Hedera x402 service on :4021
npm run hedera:payer                         # Hedera payer API on :4023
npm run hedera:announce                      # publish HCS-14 identities
```

## Integrations

- **World** — Selfie Check is the entry point. One human, one credit line;
  sessions are signed cookies carrying the verified nullifier, and every route
  that spends money reads the human from there.
- **Arc / Circle** — the credit facility contract, and x402 nanopayments settled
  against Circle Gateway balances.
- **Hedera** — a live x402 service settled through Blocky402, metered per record;
  HIP-423 scheduled repayments; an HCS audit trail; HCS-14 agent identities.

## Hedera specifics

| | |
|---|---|
| x402 service | `hedera/service/server.ts`, exact scheme, Blocky402 facilitator |
| Metering | `$0.005` per record, 1–400 records — the price is a function of the request |
| Scheduled repayment | HIP-423 with `waitForExpiry`, deletable on early settlement |
| Audit trail | HCS topic, one entry per drawdown, payment and repayment |
| Agent identity | HCS-14 UAIDs, derived and announced on the topic |
| Discovery | `GET /.well-known/agent` — everything needed to buy without reading docs |

`hedera/README.md` covers that rail in depth, including why a parked repayment
is a stronger guarantee than a keeper bot or a revocable allowance.
