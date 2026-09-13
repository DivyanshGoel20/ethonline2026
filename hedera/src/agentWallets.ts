import fs from "node:fs";
import path from "node:path";
import { AccountCreateTransaction, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { clientFor, operator, type Identity } from "./config";

/**
 * The wallets Float mints for agents, and who owns each one.
 *
 * This exists so an agent can be its own borrower. Until now the parked
 * repayment was signed by a Float-held account and paid to a Float-held
 * treasury - Float scheduling a transfer from one of its pockets to another,
 * which fires on time and proves nothing. A pre-commitment only means something
 * if the party committing is the one that owes.
 *
 * So the agent signs, and the schedule debits the agent. That turns the parked
 * transfer into a real claim on the agent's future balance: one that earns has
 * its debt collected out of its earnings, one that does not defaults in public.
 * Float goes back to being the underwriter rather than its own counterparty.
 *
 * Keys live here because Float custodies them in this deployment. In a real one
 * the agent holds its own and signs for itself - which is the same argument the
 * terms text already makes about the borrower.
 */

export type AgentWallet = {
  /** Hedera account id, 0.0.x */
  id: string;
  /** ECDSA private key, raw hex. */
  key: string;
  /** World nullifier of the human who owns this agent. */
  humanOwner: string;
  label: string;
  /** EVM address derived from the same key, so one agent spans both rails. */
  evmAddress: string;
  createdAt: number;
};

function filePath(): string {
  const candidates = [
    path.resolve(process.cwd(), "hedera", "data", "agent-wallets.json"),
    path.resolve(process.cwd(), "data", "agent-wallets.json"),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return candidates[0];
}

function readAll(): AgentWallet[] {
  try {
    const p = filePath();
    if (!fs.existsSync(p)) return [];
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: AgentWallet[]) {
  const p = filePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, p);
}

export const findWallet = (accountId: string): AgentWallet | null =>
  readAll().find((w) => w.id === accountId) ?? null;

export const walletsFor = (humanOwner: string): AgentWallet[] =>
  readAll().filter((w) => w.humanOwner.toLowerCase() === humanOwner.toLowerCase());

/** The identity the payer signs a repayment with. */
export function identityFor(accountId: string): Identity | null {
  const w = findWallet(accountId);
  return w ? { id: w.id, key: w.key } : null;
}

/**
 * Mints an agent a wallet of its own.
 *
 * Zero HBAR on purpose: Blocky402 is the fee payer on every settlement, so an
 * agent on this rail never needs gas. It starts with nothing and owes nothing,
 * and whatever it later earns is what its parked repayments collect from.
 */
export async function provisionWallet(params: {
  humanOwner: string;
  label: string;
}): Promise<AgentWallet> {
  const client = clientFor(operator());
  try {
    const key = PrivateKey.generateECDSA();
    const receipt = await new AccountCreateTransaction()
      .setECDSAKeyWithAlias(key)
      .setInitialBalance(new Hbar(0))
      .setMaxAutomaticTokenAssociations(-1)
      .setAccountMemo(`Float agent - ${params.label}`.slice(0, 100))
      .execute(client)
      .then((r) => r.getReceipt(client));

    const id = receipt.accountId?.toString();
    if (!id) throw new Error("account creation returned no id");

    const wallet: AgentWallet = {
      id,
      key: key.toStringRaw(),
      humanOwner: params.humanOwner,
      label: params.label,
      // Same key, other rail. The agent is one identity with two addresses
      // rather than two agents that happen to be operated together.
      evmAddress: `0x${key.publicKey.toEvmAddress()}`,
      createdAt: Date.now(),
    };

    const all = readAll();
    all.push(wallet);
    writeAll(all);
    return wallet;
  } finally {
    client.close();
  }
}
