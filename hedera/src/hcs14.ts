import crypto from "node:crypto";
import bs58 from "bs58";

/**
 * HCS-14 Universal Agent IDs.
 *
 * An agent that exists on two rails and in three registries has three
 * identities and no identity. HCS-14 gives it one: a deterministic id derived
 * from what the agent actually is, so the same agent resolves to the same UAID
 * from anywhere, with routing information carried in the identifier itself.
 *
 * Two targets. `aid` derives an id by hashing canonical agent data, for agents
 * that have no self-sovereign identity of their own. `did` reuses an existing
 * W3C DID and hashes nothing. Float's agents have no DID, so they take `aid`.
 *
 * Spec: https://hol.org/docs/standards/hcs-14/
 */

export interface AgentFacts {
  /** Registry namespace. "self" when the agent is not in a shared registry. */
  registry: string;
  name: string;
  version: string;
  /** Protocol the agent speaks, e.g. "x402", "a2a", "mcp", "hcs-10". */
  protocol: string;
  /** The protocol's native id. CAIP-10 preferred. */
  nativeId: string;
  /** Skill codes, numeric per the standard's registry. */
  skills: number[];
}

export interface UaidParams {
  uid?: string;
  registry?: string;
  proto?: string;
  nativeId?: string;
  domain?: string;
}

/**
 * The canonical form the hash is taken over.
 *
 * Every step here is load-bearing: registry and protocol lowercased, strings
 * trimmed, skills sorted ascending, keys alphabetical. Two parties describing
 * the same agent must produce byte-identical JSON or they derive different ids
 * for it, which defeats the point of a deterministic identifier.
 */
export function canonicalise(facts: AgentFacts): string {
  const canonical = {
    name: facts.name.trim(),
    nativeId: facts.nativeId.trim(),
    protocol: facts.protocol.trim().toLowerCase(),
    registry: facts.registry.trim().toLowerCase(),
    skills: [...facts.skills].sort((a, b) => a - b),
    version: facts.version.trim(),
  };

  // Keys are written in alphabetical order above; JSON.stringify preserves
  // insertion order, so this is the canonical serialisation.
  return JSON.stringify(canonical);
}

/** SHA-384 over the canonical JSON, Base58-encoded, per the standard. */
export function deriveAid(facts: AgentFacts): string {
  const digest = crypto.createHash("sha384").update(canonicalise(facts), "utf8").digest();
  return bs58.encode(digest);
}

function serialiseParams(params: UaidParams): string {
  // The standard fixes this ordering; it is part of the identifier, not a
  // presentation detail.
  const ordered: Array<[string, string | undefined]> = [
    ["uid", params.uid],
    ["registry", params.registry],
    ["proto", params.proto],
    ["nativeId", params.nativeId],
    ["domain", params.domain],
  ];
  return ordered
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join(";");
}

/** `uaid:aid:<base58 sha-384>;uid=...;registry=...;proto=...;nativeId=...` */
export function uaidForAgent(facts: AgentFacts, params: UaidParams = {}): string {
  const id = deriveAid(facts);
  const tail = serialiseParams({
    uid: params.uid ?? "0",
    registry: params.registry ?? facts.registry,
    proto: params.proto ?? facts.protocol,
    nativeId: params.nativeId ?? facts.nativeId,
    domain: params.domain,
  });
  return `uaid:aid:${id};${tail}`;
}

/** The DID target: an existing self-sovereign id, reused rather than rehashed. */
export function uaidFromDid(did: string, params: UaidParams = {}): string {
  const methodSpecific = did.replace(/^did:[^:]+:/, "");
  const tail = serialiseParams({ uid: params.uid ?? "0", ...params });
  return `uaid:did:${methodSpecific}${tail ? `;${tail}` : ""}`;
}

export interface ParsedUaid {
  target: "aid" | "did";
  id: string;
  params: Record<string, string>;
}

export function parseUaid(uaid: string): ParsedUaid | null {
  const m = /^uaid:(aid|did):([^;]+)(?:;(.*))?$/.exec(uaid.trim());
  if (!m) return null;

  const params: Record<string, string> = {};
  for (const pair of (m[3] ?? "").split(";").filter(Boolean)) {
    const at = pair.indexOf("=");
    if (at > 0) params[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return { target: m[1] as "aid" | "did", id: m[2], params };
}
