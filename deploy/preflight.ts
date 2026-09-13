/**
 * Check a deployment before you find out from a judge.
 *
 * Every failure below is one somebody would otherwise hit live: a feed that
 * answers 200 instead of 402 sells nothing, a payer that answers without its
 * secret is spendable by anyone who finds it, and a session secret that differs
 * between web and payer fails closed in a way that reads as "the agent can't
 * spend" rather than "the secret is wrong".
 *
 *   npx tsx deploy/preflight.ts https://feed... https://web... https://payer...
 */
const [feed, web, payer] = process.argv.slice(2);

let failed = 0;
const ok = (m: string) => console.log(`  \x1b[32mok\x1b[0m    ${m}`);
const bad = (m: string) => { failed++; console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`); };
const skip = (m: string) => console.log(`  --    ${m}`);

async function checkFeed(base: string) {
  console.log(`\nfeed  ${base}`);
  try {
    const res = await fetch(`${base}/risk?records=2`);
    if (res.status !== 402) return bad(`/risk answered ${res.status}, expected 402 — it is not gated`);

    const header = res.headers.get("payment-required");
    if (!header) return bad("402 carried no PAYMENT-REQUIRED header");

    const payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    const accept = (payload.accepts ?? [])[0];
    if (!accept) return bad("PAYMENT-REQUIRED listed no payment options");
    if (accept.network !== "hedera:testnet") return bad(`network is ${accept.network}, expected hedera:testnet`);
    if (!accept.extra?.feePayer) return bad("no facilitator feePayer — Blocky402 is not wired");
    ok(`402 quotes ${accept.amount} on ${accept.network}, feePayer ${accept.extra.feePayer}`);

    // The price must move with the request, or it is not metered.
    const one = await fetch(`${base}/risk?records=1`);
    const a1 = JSON.parse(Buffer.from(one.headers.get("payment-required")!, "base64").toString("utf8")).accepts[0];
    if (a1.amount === accept.amount) bad("price did not change between 1 and 2 records — metering is broken");
    else ok(`metered: 1 record ${a1.amount}, 2 records ${accept.amount}`);

    const disc = await fetch(`${base}/.well-known/agent`);
    disc.ok ? ok("/.well-known/agent reachable") : bad(`/.well-known/agent returned ${disc.status}`);
  } catch (err: any) {
    bad(`unreachable: ${err?.message ?? err}`);
  }
}

async function checkPayer(base: string) {
  console.log(`\npayer ${base}`);
  try {
    const open = await fetch(`${base}/status`);
    if (open.status === 401) ok("refuses callers without the payer secret");
    else bad(`/status answered ${open.status} with no secret — anyone reaching this can spend the facility`);
  } catch (err: any) {
    bad(`unreachable: ${err?.message ?? err}`);
  }
}

async function checkWeb(base: string) {
  console.log(`\nweb   ${base}`);
  try {
    const root = await fetch(base);
    root.ok ? ok(`serving (${root.status})`) : bad(`root answered ${root.status}`);

    // Spending routes must refuse an anonymous caller.
    for (const path of ["/api/hedera/pay", "/api/borrow"]) {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      res.status === 401
        ? ok(`${path} refuses anonymous callers`)
        : bad(`${path} answered ${res.status} unauthenticated, expected 401`);
    }

    const sched = await fetch(`${base}/api/hedera/schedules`);
    sched.status === 401
      ? ok("/api/hedera/schedules refuses anonymous callers")
      : bad(`/api/hedera/schedules answered ${sched.status}, expected 401`);
  } catch (err: any) {
    bad(`unreachable: ${err?.message ?? err}`);
  }
}

async function main() {
  if (!feed && !web && !payer) {
    console.error("usage: npx tsx deploy/preflight.ts <feedUrl> [webUrl] [payerUrl]");
    process.exit(1);
  }
  if (feed) await checkFeed(feed.replace(/\/$/, "")); else skip("no feed url given");
  if (web) await checkWeb(web.replace(/\/$/, "")); else skip("no web url given");
  if (payer) await checkPayer(payer.replace(/\/$/, "")); else skip("no payer url given");

  console.log(failed ? `\n${failed} check(s) failed\n` : `\nall checks passed\n`);
  process.exit(failed ? 1 : 0);
}

main();
