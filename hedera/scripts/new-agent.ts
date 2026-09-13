/**
 * Mints an empty agent wallet.
 *
 * No USDC, and no HBAR either - Blocky402 is the fee payer on every settlement,
 * so an agent on this rail never needs gas. The account exists only to be an
 * identity: something the trail can name and a credit line can be extended to.
 *
 * That emptiness is the point. An account holding nothing cannot self-fund any
 * call, so everything it does exercises Float rather than its own balance.
 *
 *   npm run hedera:new-agent -- "research-bot"
 */
import { AccountCreateTransaction, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { clientFor, hashscanAccount, operator } from "../src/config";

const LABEL = process.argv[2] || "claude-agent";

async function main() {
  const client = clientFor(operator());
  try {
    const key = PrivateKey.generateECDSA();
    const receipt = await new AccountCreateTransaction()
      .setECDSAKeyWithAlias(key)
      .setInitialBalance(new Hbar(0))
      .setMaxAutomaticTokenAssociations(-1)
      .setAccountMemo(`Float agent - ${LABEL}`)
      .execute(client)
      .then((r) => r.getReceipt(client));

    const id = receipt.accountId?.toString();
    if (!id) throw new Error("account creation returned no id");

    console.log(`\n  agent    ${id}   (${LABEL})`);
    console.log(`  balance  0 USDC, 0 HBAR - it can fund nothing on its own`);
    console.log(`  ${hashscanAccount(id)}\n`);
    console.log(`  Use it:  npm run float:fetch -- "<url>" --as ${id} --key ${key.toStringRaw()}\n`);
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error("failed:", err?.message || err);
  process.exit(1);
});
