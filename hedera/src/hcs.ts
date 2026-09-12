/**
 * The payment trail, on the Hedera Consensus Service.
 *
 * Float already kept a payment ledger, but it lived in a JSON file on whichever
 * box happened to be serving the app - which is a record of what Float says
 * happened, not a record anyone else can check. HCS gives the same entries a
 * consensus timestamp and a public topic, so a lender, a borrower and a
 * sceptical third party read the identical sequence.
 *
 * Entries are written after the fact and are never the source of truth for how
 * much is owed; Arc's facility contract is. This is the audit trail, not the
 * ledger.
 */
import { TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { MIRROR_NODE, clientFor, operator, type Identity } from "./config";

export type TrailEntry =
  | {
      kind: "drawdown";
      agent: string;
      human: string;
      amount: string;
      /** The scheduled repayment created alongside it. */
      scheduleId: string;
      dueAt: string;
    }
  | { kind: "payment"; agent: string; resource: string; amount: string; transactionId: string }
  | { kind: "repayment"; human: string; amount: string; scheduleId: string; transactionId?: string };

/** Creates the topic Float writes its trail to. Run once, via scripts/setup.ts. */
export async function createTopic(as: Identity = operator()): Promise<string> {
  const client = clientFor(as);
  try {
    const receipt = await new TopicCreateTransaction()
      .setTopicMemo("Float credit facility - agent payment trail")
      .execute(client)
      .then((r) => r.getReceipt(client));

    const id = receipt.topicId?.toString();
    if (!id) throw new Error("topic creation returned no id");
    return id;
  } finally {
    client.close();
  }
}

/**
 * Appends one entry. Deliberately fire-and-forget at the call site: a failed
 * audit write must never roll back a payment that actually happened, so callers
 * log the failure and carry on rather than surfacing it as a payment error.
 */
export async function append(
  topic: string,
  entry: TrailEntry,
  as: Identity = operator()
): Promise<{ transactionId: string; sequenceNumber: string }> {
  const client = clientFor(as);
  try {
    const body = JSON.stringify({ ...entry, at: new Date().toISOString() });
    const response = await new TopicMessageSubmitTransaction()
      .setTopicId(topic)
      .setMessage(body)
      .execute(client);

    const receipt = await response.getReceipt(client);
    return {
      transactionId: response.transactionId.toString(),
      sequenceNumber: receipt.topicSequenceNumber?.toString() ?? "0",
    };
  } finally {
    client.close();
  }
}

/**
 * Reads the trail back through the Mirror Node rather than the consensus nodes,
 * which is the supported way to query history.
 */
export async function read(topic: string, limit = 25): Promise<(TrailEntry & { at: string; sequenceNumber: number })[]> {
  const url = `${MIRROR_NODE}/api/v1/topics/${topic}/messages?limit=${limit}&order=desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mirror node returned ${res.status} for topic ${topic}`);

  const body = (await res.json()) as { messages?: { message: string; sequence_number: number }[] };
  const out: (TrailEntry & { at: string; sequenceNumber: number })[] = [];

  for (const m of body.messages ?? []) {
    try {
      out.push({
        ...JSON.parse(Buffer.from(m.message, "base64").toString("utf8")),
        sequenceNumber: m.sequence_number,
      });
    } catch {
      // A topic is public and anyone may write to it unless a submit key says
      // otherwise. Skip what Float did not write rather than failing the read.
    }
  }
  return out;
}
