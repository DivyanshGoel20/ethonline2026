/**
 * Anchor Float's agent identities on the consensus service.
 *
 * A UAID served over HTTP is a claim by whoever runs the server. The same UAID
 * written to an HCS topic, next to the facts it was derived from, is a claim
 * anyone can check and timestamp: recompute the hash, compare, and read when it
 * was made. That is the difference between an identifier and an identity.
 *
 * Run once per identity, or again after any of the facts change - the UAID is
 * derived from them, so a change produces a different id.
 *
 *   npm run hedera:announce
 */
import { agent, seller, optionalTopicId, hashscanTopic } from "../src/config";
import { uaidForAgent, type AgentFacts } from "../src/hcs14";
import { append } from "../src/hcs";

const identities: AgentFacts[] = [
  {
    registry: "self",
    name: "Float Risk Feed",
    version: "1.0.0",
    protocol: "x402",
    nativeId: `hedera:testnet:${seller().id}`,
    skills: [0, 17],
  },
  {
    registry: "self",
    name: "Float Paying Agent",
    version: "1.0.0",
    protocol: "x402",
    nativeId: `hedera:testnet:${agent().id}`,
    skills: [0],
  },
];

async function main() {
  const topic = optionalTopicId();
  if (!topic) throw new Error("FLOAT_HCS_TOPIC_ID is not set; run npm run hedera:setup first.");

  for (const facts of identities) {
    const uaid = uaidForAgent(facts);
    const entry = await append(topic, {
      kind: "identity",
      uaid,
      nativeId: facts.nativeId,
      name: facts.name,
      protocol: facts.protocol,
      version: facts.version,
      skills: facts.skills,
    });
    console.log(`${facts.name}\n  ${uaid}\n  sequence ${entry.sequenceNumber}\n`);
  }

  console.log(`topic ${hashscanTopic(topic)}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
