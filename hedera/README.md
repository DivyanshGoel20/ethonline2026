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

## An agent spends under a mandate, not by asking

Two agents were handed this rail without being told how it worked, and both
objected to the same thing: a purchase silently became a loan, and the terms
turned up after the debt existed. The second went further and caught the
disclosure naming the wrong borrower.

The first fix was to make the *agent* consent per purchase. That was the wrong
abstraction. Float lends to a World-verified human, and an agent spending that
line is the product — the human already consented, when they verified and opened
the facility. What was missing was any way for an agent running outside the
browser to prove **which human sent it**.

So it works like a card now. A verified human issues a token to their agent with
a cap they choose (`POST /api/agent-token`). Issuing it *is* the authorisation.
The agent spends inside that cap without asking again, and the party that agreed
and the party that owes are the same person.

```
no mandate      -> nothing bought, nothing owed
mandate 0.004   -> declined: 0.015 exceeds the credit allowance of 0.004000
mandate 0.50    -> paid 0.015 USDC on your human's credit line
```

Every purchase goes through the app rather than straight at the payer, because
the app is what knows whose line is being spent. It binds the smaller of the
mandate cap and the human's remaining Arc headroom, then records the drawdown
against that human in `railDebt` — so Arc and Hedera net against **one** limit
and the line cannot be spent twice.

`hedera/service/payer-api.ts` is mechanism, not policy: it knows how to buy
things on Hedera and nothing about whose money it is. It used to be reachable by
anyone who could open the port. It now requires `FLOAT_PAYER_SECRET`, so the
only caller is the app that did the authorising.

```bash
npm run hedera:issue-token -- <humanNullifier> 0.50 7   # what the browser does
npm run float:fetch -- --mandate                        # what am I allowed to spend
npm run float:fetch -- --records 3                      # spend it
```

Verified: a forged signature and an expired token are both refused, the cap
binds independently of headroom, and the debt lands on the issuing human.

### The mandate works on both rails

A card that only worked on one rail would make "one credit line" true only if you
never used the other half of it. `resolveSpender` sits under Arc's pay, borrow,
repay and sign routes as well, so the same token spends on either:

```
POST /api/borrow   no auth                      -> 401
POST /api/borrow   mandate 0.50, borrow 0.01    -> 200, real Arc tx
POST /api/borrow   mandate 0.004, borrow 0.01   -> 403, over mandate
```

Where the price is known up front (`/api/borrow`) the cap is checked directly;
on `/api/pay` it is not known until the resource answers with a 402, so the cap
travels into the signer and folds into the headroom it already applies — the
tightest of agent limit, facility headroom and mandate cap binds.

Spending and administering are deliberately separate. A browser session is the
human present in person and can register agents or issue mandates; a mandate is
a card and can only spend:

```
POST /api/agents       with a mandate -> 401
POST /api/agent-token  with a mandate -> 401
```

Without that split, a leaked token could mint itself a larger one.

Both rails net against one limit. After an Arc drawdown and a Hedera one against
a 10 USDC line: 5.03 drawn on Arc, 0.04 on Hedera, 4.93 left to either.

### Closing the books after the network moves

A parked repayment executes unattended - which is the point, and also why
nothing in Float noticed when it did. A debt consensus collected a week ago
still read as outstanding and went on consuming the human's line; repaying early
was the only way the books ever closed.

`reconcileRailDebt` asks the Mirror Node what became of each parked repayment
and writes it down. The distinction that matters is that **a schedule which
fails is still stamped executed**, so asking only "did it execute" reports a
default as a repayment. The consensus result behind the execution is read too:

```
  checked      6 parked repayment(s)
  settled      1
    0.0.10521924  0.005 USDC  headroom returned
  defaulted    1
    0.0.10521952  0.01 USDC  INSUFFICIENT_TOKEN_BALANCE - still owed
  not yet due  4
```

Rail debt went 0.055 → 0.05 across that run: only the settled 0.005 came back.
**A default keeps consuming the line**, because a default that freed up headroom
would make failing to pay the cheapest way to borrow again.

Running it twice is a no-op, and a mirror that cannot answer leaves the debt
open rather than guessing. `POST /api/hedera/reconcile` does one human;
`npm run hedera:reconcile` sweeps everyone, for a cron. Both are session-only —
a spending mandate can spend, not declare its own debts paid.

### One cheque for a hundred payments

Parking a schedule per payment repeated the mistake Arc made with per-drawdown
storage writes: a 0.005 USDC purchase cost two consensus transactions to promise
0.005 USDC back, so the obligation was dearer than the loan.

A **tranche** fixes the ratio without giving up the guarantee. Float parks one
schedule for a ceiling, signed by the borrower up front, and settles payments
against it until the ceiling is reached. The promise still precedes the
spending - which is the entire reason to do this on Hedera rather than with a
keeper bot - it is simply made once for many payments instead of once each.

```
  payment 1: PARKED new tranche 0.0.10522615  0.005000/0.050000
  payment 2: drew on existing   0.0.10522615  0.010000/0.050000
  payment 3: drew on existing   0.0.10522615  0.015000/0.050000
  payment 4: drew on existing   0.0.10522615  0.020000/0.050000

  schedules parked for 4 payments: 1
```

Closing collects what was drawn, not the ceiling
([`0.0.10509545@1789299986`](https://hashscan.io/testnet/transaction/0.0.10509545-1789299986-143800418)):
0.020000 USDC moved, the 0.050000 schedule was **deleted without ever
executing**, and four payments were covered by one obligation.

The honest cost is that a tranche left open collects its ceiling. That is why
closing is part of the flow rather than cleanup - `POST /tranche/close`
transfers the true amount and deletes the schedule, by the same early-settlement
path a borrower uses. `GET /tranches` shows what is drawn against what.

Off by default (`FLOAT_TRANCHE_BATCHING=true`), because a ceiling is only right
when someone has chosen it, and the per-payment path is the one the rest of this
document demonstrates.

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

Not a dry run. Operator `0.0.7975935`, run on 12-13 September 2026.

| what | evidence |
|---|---|
| Agent self-funds a small call | [`0.0.7162784@1789245800`](https://hashscan.io/testnet/transaction/0.0.7162784@1789245800.184864946) — 0.005 USDC |
| Agent short, Float covers it | [`0.0.7162784@1789245813`](https://hashscan.io/testnet/transaction/0.0.7162784@1789245813.947674847) — 0.125 USDC |
| Repayment parked before the spend | schedule [`0.0.10509672`](https://hashscan.io/testnet/schedule/0.0.10509672), `wait_for_expiry: true` |
| Consensus executed it, unattended | `executed_at` 2026-09-12T20:44:41Z; borrower `0.0.10509545` went 0.875000 → 0.750000 USDC |
| Trail | topic [`0.0.10509546`](https://hashscan.io/testnet/topic/0.0.10509546), entries #11 drawdown → #12 payment → #13 repayment |
| Repayment fired and **paid**, unattended | schedule [`0.0.10521924`](https://hashscan.io/testnet/schedule/0.0.10521924) → tx [`0.0.7975935@1789296794`](https://hashscan.io/testnet/transaction/0.0.7975935-1789296794-924233347) — `SUCCESS`, 0.005 USDC |
| Repayment fired and **defaulted**, same morning | schedule [`0.0.10521952`](https://hashscan.io/testnet/schedule/0.0.10521952) → tx [`0.0.7975935@1789296897`](https://hashscan.io/testnet/transaction/0.0.7975935-1789296897-663112783) — `INSUFFICIENT_TOKEN_BALANCE`, 0.01 USDC |

Every settlement transaction id begins `0.0.7162784` — Blocky402's fee payer,
submitting on behalf of a payer who never held HBAR.

The last two rows are the whole argument in one pair. Both schedules were parked
the same morning, both executed on their own date with nobody watching, and both
are stamped `executed`. Only the consensus result separates them: borrower
`0.0.10509545` covered its 0.005 and the headroom came back; borrower
`0.0.10521951` could not cover its 0.01, the transfer moved nothing, and the
debt still stands. Float wrote both outcomes down without being told, by asking
the Mirror Node rather than by being notified. Check either link — neither
requires trusting this repository.

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
