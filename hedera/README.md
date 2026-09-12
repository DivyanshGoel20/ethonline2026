# Float on Hedera

Float is an undercollateralised credit line for autonomous agents. An agent
spends against a human's credit; the human is unique because World ID says so;
the debt is recorded on Arc.

This directory is Float's Hedera rail: a live x402-gated service, an agent that
pays it, and — the part that only works here — **a repayment that is parked on
the ledger before the money is spent**.

## Why Hedera, specifically

Float's weakest joint has always been collection. A credit line is easy to
extend and hard to enforce: on an EVM chain, "the borrower repays on the 30th"
is either a keeper bot with a hot key and a cron job, or an ERC-20 allowance the
borrower can revoke the second the goods arrive. Both are bets on future
liveness, and both fail in the same direction — against the lender.

[HIP-423](https://hips.hedera.com/hip/hip-423) lets the transfer itself sit on
the network. The borrower signs once, at drawdown. Consensus holds a
fully-formed transaction with an execution date on it, and executes it when the
clock gets there. Nobody has to be online — not Float, not the borrower, not a
bot.

It is not a guarantee of funds. If the account is empty at expiry the transfer
fails — and that failure is the point: a default that anyone watching the
schedule can see, rather than a number the lender asserts.

## Architecture

Two rails, one ledger.

```
        World ID ──── one human, one credit line
            │
            ▼
    ┌───────────────┐   authoritative debt ledger
    │  Arc testnet  │   profiles, limits, drawdowns, repayments
    │  FloatCredit  │
    │   Facility    │
    └───────┬───────┘
            │ headroom check
            ▼
    ┌─────────────────────────────────────────────┐
    │                  Hedera                     │
    │                                             │
    │  ScheduleCreateTransaction  ── repayment,   │
    │    waitForExpiry = true        dated, parked│
    │                                             │
    │  x402 exact scheme ─────────── the spend    │
    │    via Blocky402                            │
    │                                             │
    │  HCS topic ─────────────────── the trail    │
    └─────────────────────────────────────────────┘
```

Arc holds what is owed. Hedera is where value moves and where the obligation to
return it is enforced. Nothing is duplicated: the HCS trail is an audit record,
never the source of truth for a balance.

## The payment flow

An agent calls a metered endpoint it may or may not be able to afford.

1. **Quote.** The agent GETs the resource unpaid and reads the 402. The
   requirements arrive in the `PAYMENT-REQUIRED` header — base64 JSON with
   `accepts[]`, each carrying `amount`, `asset`, `payTo`, and the facilitator's
   `extra.feePayer`.
2. **Decide.** The agent's USDC balance is read from the Mirror Node. Enough, and
   it pays for itself. Short, and Float steps in.
3. **Park the repayment — before spending.** A `TransferTransaction` (borrower →
   Float treasury, USDC) is wrapped in a `ScheduleCreateTransaction` with
   `setWaitForExpiry(true)` and an expiry at the repayment date. The borrower
   signs it. The obligation now exists on-ledger, ahead of any money moving, so
   there is no window where Float has paid and holds only a promise.
4. **Settle.** Whoever is funding signs a partially-signed `TransferTransaction`;
   **Blocky402 counter-signs as fee payer and submits it**. Neither the agent nor
   Float needs HBAR for gas — that is the Hedera-specific half of the exact
   scheme.
5. **Record.** Drawdown and payment are appended to an HCS topic, read back
   through the Mirror Node.

Step 3 sitting ahead of step 4 is the whole design. Reverse them and you are
back to hoping.

## Metering

`GET /risk?records=N` is priced per record, not per call — the 402 quotes
`N × $0.005`, clamped at 25. A subscription cannot price a query whose shape the
buyer picks at request time; that is the argument for machine payments, so the
demo makes the price actually move.

| `records` | quoted |
|---|---|
| 1 | 0.005000 USDC |
| 5 | 0.025000 USDC |
| 20 | 0.100000 USDC |
| 999 | 0.125000 USDC (clamped at 25) |

## Setup

```bash
npm install
cp hedera/.env.example .env
```

1. Create a **testnet account with an ECDSA key** at
   [portal.hedera.com](https://portal.hedera.com). Put the account id and key in
   `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_KEY`.
2. Claim testnet USDC at [faucet.circle.com](https://faucet.circle.com) — choose
   **Hedera Testnet**, send to your operator account.
3. Provision the demo accounts, open them to USDC, and create the HCS topic:

   ```bash
   npm run hedera:setup
   ```

   Paste the printed env lines back into `.env`.

Then, in two terminals:

```bash
npm run hedera:service    # the x402-gated Float Risk Feed
npm run hedera:demo       # the agent: one call it can afford, one it cannot
```

## Layout

| path | what it is |
|---|---|
| `service/server.ts` | the x402-gated endpoint, settled via Blocky402 |
| `service/risk.ts` | what the feed sells |
| `agent/payer.ts` | quote → decide → park repayment → settle → record |
| `src/scheduled.ts` | HIP-423 repayment parking and inspection |
| `src/hcs.ts` | the payment trail |
| `src/mirror.ts` | balances, read from the Mirror Node |
| `src/config.ts` | ids, assets, and the facilitator |
| `scripts/setup.ts` | one-time provisioning |
| `scripts/demo.ts` | the end-to-end run |

## Facts worth pinning

| | |
|---|---|
| network | `hedera:testnet` |
| scheme | `exact`, x402 v2 |
| asset | USDC `0.0.429274`, 6 decimals |
| facilitator | `https://api.testnet.blocky402.com` — no API key |
| fee payer | `0.0.7162784` (Blocky402's, from `/supported`) |
| schedule ceiling | 2 months |

## Honest notes

- The borrower's key lives in `.env` for the demo, so one script can show the
  whole arc. In production the borrower signs the schedule from their own wallet
  — and Hedera's design is what makes that a **single** signature at drawdown
  rather than a standing allowance.
- The risk feed's records are a fixed sample, not live underwriting data. They
  are deterministic on purpose: two buyers asking for the same record get the
  same answer, which is the least a paid feed owes anyone.
