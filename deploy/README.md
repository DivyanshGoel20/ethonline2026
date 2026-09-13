# Deploying Float

Four services. One of them is a hard requirement of the Hedera prize — *"host a
live x402-gated service on Hedera testnet, settled through the Blocky402
facilitator"* — so deploy that one first and the submission is de-risked before
anything else is touched.

## Not serverless

Eleven modules keep state in JSON on local disk: agents, loans, rail debt,
parked schedules, agent wallets. `writeJsonAtomic` writes and renames with no
catch, so on a read-only filesystem every registration and drawdown throws. A
platform whose `/tmp` is per-instance and wiped between invocations will also
have two requests disagree about who owes what.

So: a container host with a persistent disk — Railway, Render, Fly. Migrating to
Postgres is the right long-term answer and the wrong pre-deadline one; a volume
buys the same correctness this week.

## The four

| service | public | volume | start |
|---|---|---|---|
| feed | **yes** — the prize needs it | none | `npx tsx hedera/service/server.ts` |
| web | yes | `web/data` | `npm --workspace=web run start` |
| payer | no (secret-guarded) | `hedera/data` | `npx tsx hedera/service/payer-api.ts` |
| premium | yes | none | `npm --prefix float-premium-api start` |

Configs for each are in this directory as `*.railway.json`. Point a Railway
service at the repo and set its config path; the build and start commands come
from there.

## Order

**1. The feed.** No state, no volume, and the only secrets are the operator and
seller accounts. Once `curl https://<feed>/risk?records=1` answers `402` with a
`PAYMENT-REQUIRED` header, requirement #1 is satisfied from a public URL.

**2. The payer.** Mount a volume at `hedera/data` or every parked repayment is
forgotten on redeploy and nothing can be settled early. Set `HEDERA_SERVICE_URL`
to the feed's public URL.

**3. The web app.** Mount a volume at `web/data`. Set `HEDERA_PAYER_URL` to the
payer's internal URL.

**4. Premium**, if you want the Arc rail reachable too.

## Two things that fail quietly

**`PORT`.** The host injects it and expects the process to bind to it. Each
service prefers its own variable first, so setting `HEDERA_SERVICE_PORT` in
production wins over `PORT` and the proxy reaches nothing. Leave those unset.

**The shared secrets.** `FLOAT_SESSION_SECRET` and `FLOAT_PAYER_SECRET` must be
byte-identical across web and payer. A mismatch fails closed and presents as
"the agent can't spend" rather than "the secret is wrong", which is a bad hour to
spend during a demo.

`.env.production.example` lists every variable, grouped by which service needs it.

## Check it before a judge does

```bash
npm run preflight -- https://feed… https://web… https://payer…
```

It asserts the feed answers 402 rather than 200, that the quote moves with the
request (metering, not a flat fee), that Blocky402 is the declared fee payer,
that the payer refuses callers without its secret, and that the spending routes
turn away anonymous callers. It found a real ordering bug the first time it ran:
`/api/borrow` validated its body before authenticating, so an anonymous probe got
a 400 describing the request schema instead of a 401.
