/**
 * Float's Hedera rail: configuration and the handful of ids everything else
 * derives from.
 *
 * Float settles on two rails. Arc holds the authoritative debt ledger - the
 * credit facility contract, the profiles, the outstanding balances. Hedera is
 * where an agent actually spends, and where the repayment it promises is parked
 * on the network in advance. Nothing here duplicates the ledger; it only moves
 * value and records what moved.
 */
import {
  AccountId,
  Client,
  PrivateKey,
  HEDERA_TESTNET_CAIP2,
  HEDERA_TESTNET_USDC,
  HEDERA_USDC_DECIMALS,
  HEDERA_TESTNET_MIRROR_NODE_URL,
} from "@x402/hedera";

export const NETWORK = HEDERA_TESTNET_CAIP2;
export const USDC = HEDERA_TESTNET_USDC;
export const USDC_DECIMALS = HEDERA_USDC_DECIMALS;
export const MIRROR_NODE = HEDERA_TESTNET_MIRROR_NODE_URL;

/**
 * Blocky402 adds its own signature to the payer's partially-signed transfer and
 * submits it, so the fee payer is the facilitator rather than either party to
 * the trade. That is the Hedera-specific half of the x402 exact scheme: an
 * agent can pay without ever holding gas.
 */
export const FACILITATOR_URL = process.env.BLOCKY402_URL || "https://api.testnet.blocky402.com";

export const HASHSCAN = "https://hashscan.io/testnet";
export const hashscanTx = (id: string) => `${HASHSCAN}/transaction/${id}`;
export const hashscanAccount = (id: string) => `${HASHSCAN}/account/${id}`;
export const hashscanTopic = (id: string) => `${HASHSCAN}/topic/${id}`;
export const hashscanSchedule = (id: string) => `${HASHSCAN}/schedule/${id}`;

export type Identity = { id: string; key: string };

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `${name} is not set. Fill it in in .env (see hedera/.env.example for what each value is), ` +
        `then run: npm run hedera:setup`
    );
  }
  return v.trim();
}

/**
 * Keys are ECDSA, which is what the Hedera portal hands out and what the x402
 * scheme's payer-signature verification assumes.
 */
export const parseKey = (raw: string): PrivateKey => PrivateKey.fromStringECDSA(raw.trim());

/** Float's own account: underwriter, payer of last resort, HCS topic owner. */
export const operator = (): Identity => ({
  id: required("HEDERA_OPERATOR_ID"),
  key: required("HEDERA_OPERATOR_KEY"),
});

/** The agent that spends. Provisioned by scripts/setup.ts. */
export const agent = (): Identity => ({
  id: required("HEDERA_AGENT_ID"),
  key: required("HEDERA_AGENT_KEY"),
});

/**
 * The human on the hook. Falls back to Float's own account so a demo runs
 * without a separate borrower, which is also why nothing here is a claim about
 * consent: in a real deployment this key belongs to the borrower and Float
 * never sees it.
 */
export const borrower = (): Identity => ({
  id: process.env.HEDERA_BORROWER_ID?.trim() || required("HEDERA_OPERATOR_ID"),
  key: process.env.HEDERA_BORROWER_KEY?.trim() || required("HEDERA_OPERATOR_KEY"),
});

/** The x402-gated service's payee. Provisioned by scripts/setup.ts. */
export const seller = (): Identity => ({
  id: required("HEDERA_SELLER_ID"),
  key: required("HEDERA_SELLER_KEY"),
});

export const topicId = (): string => required("FLOAT_HCS_TOPIC_ID");
export const optionalTopicId = (): string | null => process.env.FLOAT_HCS_TOPIC_ID?.trim() || null;

/** A Client bound to one identity. Callers must close it. */
export function clientFor({ id, key }: Identity): Client {
  return Client.forTestnet().setOperator(AccountId.fromString(id), parseKey(key));
}

/** USDC is 6-decimal, so "0.05" is 50000 smallest units. */
export function toUnits(amount: string | number): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  const padded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  return BigInt(whole || "0") * 10n ** BigInt(USDC_DECIMALS) + BigInt(padded || "0");
}

export function fromUnits(units: bigint | string): string {
  const v = BigInt(units);
  const base = 10n ** BigInt(USDC_DECIMALS);
  return `${v / base}.${(v % base).toString().padStart(USDC_DECIMALS, "0")}`;
}
