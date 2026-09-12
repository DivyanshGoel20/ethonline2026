/**
 * One-time provisioning for Float's Hedera rail.
 *
 * Creates the three accounts the demo needs, opens them to USDC, and creates
 * the HCS topic the payment trail is written to. Run it once after filling in
 * HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY; it prints the env lines to paste
 * back, and is safe to re-run (it skips anything already configured).
 *
 *   npm run hedera:setup
 */
import {
  AccountCreateTransaction,
  AccountBalanceQuery,
  Hbar,
  PrivateKey,
  TokenAssociateTransaction,
  TransferTransaction,
} from "@hiero-ledger/sdk";
import { USDC, clientFor, fromUnits, hashscanAccount, hashscanTopic, operator, toUnits } from "../src/config";
import { createTopic } from "../src/hcs";

const INITIAL_HBAR = 15;
const USDC_SEED = "2.00";

async function createAccount(label: string): Promise<{ id: string; key: string }> {
  const client = clientFor(operator());
  try {
    const key = PrivateKey.generateECDSA();

    // Unlimited automatic associations: without this every account must run a
    // TokenAssociateTransaction before it can receive USDC, and a transfer to
    // an unassociated account fails with TOKEN_NOT_ASSOCIATED_TO_ACCOUNT.
    const receipt = await new AccountCreateTransaction()
      .setECDSAKeyWithAlias(key)
      .setInitialBalance(new Hbar(INITIAL_HBAR))
      .setMaxAutomaticTokenAssociations(-1)
      .setAccountMemo(`Float demo - ${label}`)
      .execute(client)
      .then((r) => r.getReceipt(client));

    const id = receipt.accountId?.toString();
    if (!id) throw new Error(`${label}: account creation returned no id`);

    console.log(`  ${label.padEnd(9)} ${id}  ${hashscanAccount(id)}`);
    return { id, key: key.toStringRaw() };
  } finally {
    client.close();
  }
}

/** Moves seed USDC from the operator so the agent has something to spend. */
async function seedUsdc(to: string, amount: string) {
  const float = operator();
  const client = clientFor(float);
  try {
    const units = Number(toUnits(amount));
    await new TransferTransaction()
      .addTokenTransfer(USDC, float.id, -units)
      .addTokenTransfer(USDC, to, units)
      .execute(client)
      .then((r) => r.getReceipt(client));
    console.log(`  seeded ${amount} USDC -> ${to}`);
  } finally {
    client.close();
  }
}

async function usdcBalance(id: string): Promise<bigint> {
  const client = clientFor(operator());
  try {
    const bal = await new AccountBalanceQuery().setAccountId(id).execute(client);
    return BigInt(bal.tokens?.get(USDC)?.toString() ?? "0");
  } finally {
    client.close();
  }
}

async function ensureOperatorAssociated() {
  const float = operator();
  const client = clientFor(float);
  try {
    await new TokenAssociateTransaction()
      .setAccountId(float.id)
      .setTokenIds([USDC])
      .execute(client)
      .then((r) => r.getReceipt(client));
    console.log("  operator associated with USDC");
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
      console.log("  operator already associated with USDC");
    } else {
      console.warn(`  could not associate operator with USDC: ${msg}`);
    }
  } finally {
    client.close();
  }
}

async function main() {
  const float = operator();
  console.log(`\nFloat Hedera setup - operator ${float.id}\n`);

  await ensureOperatorAssociated();

  const have = await usdcBalance(float.id);
  console.log(`  operator USDC balance: ${fromUnits(have)}`);
  if (have === 0n) {
    console.log(
      "\n  The operator holds no testnet USDC. Claim some at https://faucet.circle.com\n" +
        `  (choose Hedera Testnet, send to ${float.id}) and re-run this script.\n`
    );
  }

  console.log("\nCreating accounts:");
  const agent = await createAccount("agent");
  const seller = await createAccount("seller");
  const borrower = await createAccount("borrower");

  if (have >= toUnits(USDC_SEED)) {
    console.log("\nSeeding:");
    // The agent gets a little, so the demo can show it paying from its own
    // balance and then running out and drawing on credit.
    await seedUsdc(agent.id, "0.25");
    await seedUsdc(borrower.id, "1.00");
  } else {
    console.log("\n  Skipping USDC seeding - operator has none yet.");
  }

  console.log("\nCreating HCS topic for the payment trail:");
  const topic = await createTopic();
  console.log(`  topic ${topic}  ${hashscanTopic(topic)}`);

  console.log(`
Add these to your .env:

HEDERA_AGENT_ID=${agent.id}
HEDERA_AGENT_KEY=${agent.key}
HEDERA_SELLER_ID=${seller.id}
HEDERA_SELLER_KEY=${seller.key}
HEDERA_BORROWER_ID=${borrower.id}
HEDERA_BORROWER_KEY=${borrower.key}
FLOAT_HCS_TOPIC_ID=${topic}
`);
}

main().catch((err) => {
  console.error("\nsetup failed:", err?.message || err);
  process.exit(1);
});
