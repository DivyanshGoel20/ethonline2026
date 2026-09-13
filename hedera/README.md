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

## Giving the wallet to a real agent

The rail is reachable as a tool, not just a script, so a general-purpose agent
can be handed a wallet and left to get on with it.

```bash
npm run hedera:service                    # the paid feed
npm run float:fetch -- --wallet           # who am I, what do I have
npm run float:fetch -- --records 3        # buy some
```

`.mcp.json` registers the same thing as an MCP server, so a Claude Code session
sees `float_wallet`, `float_catalogue` and `float_fetch` as tools it can call
directly.

The wallet it runs as holds **zero USDC and zero HBAR**. It needs no gas because
Blocky402 is the fee payer on every settlement, and it needs no balance because
Float covers what it cannot. An account that holds nothing cannot self-fund a
single call, so every purchase exercises the credit path: a dated repayment is
parked on consensus, then the invoice is settled. The agent never learns it was
broke — it asks for data and gets data.

Two details that only show up when you build this:

- MCP speaks JSON-RPC over **stdout**, and the payer logs its progress to stdout
  like any CLI. Left alone, the first `quote 0.005 USDC` line corrupts the
  protocol frame and the client drops the connection. `console.log` is rebound
  to stderr before the payer is reachable.
- The agent's key is **not** in `.mcp.json`, which is committed. The server reads
  `FLOAT_MCP_AGENT_ID` / `FLOAT_MCP_AGENT_KEY` from the gitignored `.env` and
  redirects `agent()` at runtime, so the funded demo wallet and the empty agent
  wallet coexist without either config knowing about the other.

## Borrowing is opt-in

An agent was handed this rail with no explanation, bought some data, and
objected to what it found:

> I did not pay. My wallet had nothing to pay with... There was no confirmation
> step, no disclosed interest/fee terms, and no opt-out — the decision to incur
> debt in your name was made by the tooling, not by me, and I only learned the
> terms after the debt existed.

It was right on every count, so the rail changed.

- **A purchase never silently becomes a loan.** If the wallet cannot cover the
  price, nothing is bought and no debt is taken on. The caller gets the price,
  its balance, the shortfall and the full terms, and has to come back with
  `allowCredit: true` (`--allow-credit`) to proceed.
- **Terms are stated before the money moves,** not discovered afterwards, and
  `float_terms` will recite them at any point, for free.
- **Borrowing is bounded.** A call may borrow 0.50 USDC by default; more has to
  be asked for by name with `maxCreditUsd`. Previously a single call could
  borrow without limit, and `records=25` quietly borrowed five times what
  `records=5` did.

The terms themselves: principal only, **no fee and no interest**, seven-day term,
and the borrower is the Float facility account rather than the agent's wallet.

### Who is actually on the hook

The fixed rail was handed back to a fresh agent, which verified every claim
against the mirror node rather than the CLI's own output, and found the
disclosure itself was wrong. It said the borrower was the Float facility
account — true of `config.ts`'s fallback, false of this deployment, where
`HEDERA_BORROWER_ID` names a third account distinct from both the agent wallet
and the operator. An agent trusting that line would have had the counterparty
wrong.

The terms now resolve the borrower at runtime and name it, and say plainly that
the party accepting is not the party that owes:

```
Who is on the hook
  The repayment is signed by and debited from 0.0.10509545.
  That is not your wallet (0.0.10520109), and it may not be you at all.
```

That gap is real and structural, not a wording problem. Here the borrower's key
sits in `.env`, so an agent's `--allow-credit` binds an account that consented to
nothing. In a real deployment the borrower signs for themselves and the two are
the same party — which is what Hedera's scheduled transactions make possible, a
single signature at drawdown rather than a standing allowance. Until then the
disclosure says so out loud.

### What a default actually looks like

The agent also asked what happens at maturity if the borrower cannot pay, which
nobody had checked. So it was checked — an empty account, a 0.05 USDC repayment
dated ninety seconds out, schedule [`0.0.10520758`](https://hashscan.io/testnet/schedule/0.0.10520758):

```
result       INSUFFICIENT_TOKEN_BALANCE
scheduled    true
token moves  0
```

Consensus ran it, the transfer moved nothing, and the schedule is still stamped
executed. So a default is not an error anyone has to report — it is a schedule
that ran and moved nothing, visible to anyone who looks. Nothing is seized and
no penalty is charged. `npm run hedera:probe-default` reproduces it.

## Verified on testnet

Not a dry run. Operator `0.0.7975935`, run on 12 September 2026.

| what | evidence |
|---|---|
| Agent self-funds a small call | [`0.0.7162784@1789245800`](https://hashscan.io/testnet/transaction/0.0.7162784@1789245800.184864946) — 0.005 USDC |
| Agent short, Float covers it | [`0.0.7162784@1789245813`](https://hashscan.io/testnet/transaction/0.0.7162784@1789245813.947674847) — 0.125 USDC |
| Repayment parked before the spend | schedule [`0.0.10509672`](https://hashscan.io/testnet/schedule/0.0.10509672), `wait_for_expiry: true` |
| Consensus executed it, unattended | `executed_at` 2026-09-12T20:44:41Z; borrower `0.0.10509545` went 0.875000 → 0.750000 USDC |
| Trail | topic [`0.0.10509546`](https://hashscan.io/testnet/topic/0.0.10509546), entries #11 drawdown → #12 payment → #13 repayment |

Every settlement transaction id begins `0.0.7162784` — Blocky402's fee payer,
submitting on behalf of a payer who never held HBAR.

The execution was checked with a 70-second term rather than the default week,
so the claim that nobody has to be awake is tested rather than asserted.

## Honest notes

- The borrower's key lives in `.env` for the demo, so one script can show the
  whole arc. In production the borrower signs the schedule from their own wallet
  — and Hedera's design is what makes that a **single** signature at drawdown
  rather than a standing allowance.
- The risk feed's records are a fixed sample, not live underwriting data. They
  are deterministic on purpose: two buyers asking for the same record get the
  same answer, which is the least a paid feed owes anyone.
- Entry #9 on the topic reads `repayment 0.000000`. That is a real bug's
  fingerprint: an early version of the watcher wrote a repayment entry for a
  schedule that had already executed before it started looking, so it recorded a
  balance delta of zero. HCS is append-only, so it stays there. The watcher now
  refuses to write an entry for a transition it did not witness.
