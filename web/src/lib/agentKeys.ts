import fs from "fs";
import path from "path";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { arcTestnetChain } from "./facilityContract";

// Dynamic agent keys resolved from environment variables
function getEnvAgentKeys(): Record<string, `0x${string}`> {
  const envKeys: Record<string, `0x${string}`> = {};
  const rawKey = process.env.AGENT_PRIVATE_KEY;
  if (rawKey && rawKey.startsWith("0x") && rawKey.length === 66) {
    try {
      const account = privateKeyToAccount(rawKey as `0x${string}`);
      envKeys[account.address.toLowerCase()] = rawKey as `0x${string}`;
    } catch {
      // ignore invalid env key
    }
  }
  return envKeys;
}

function getKeysFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), "web", "data", "agent-keys.json"),
    path.resolve(process.cwd(), "data", "agent-keys.json"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "data", "agent-keys.json");
}

function loadKeys(): Record<string, string> {
  const envKeys = getEnvAgentKeys();
  try {
    const filePath = getKeysFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return { ...envKeys, ...JSON.parse(content) };
    }
  } catch (err) {
    console.warn("[AgentKeys] Error reading agent keys file:", err);
  }
  return { ...envKeys };
}

function saveKeys(keys: Record<string, string>) {
  try {
    const filePath = getKeysFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(keys, null, 2), "utf8");
  } catch (err) {
    console.error("[AgentKeys] Error writing agent keys file:", err);
  }
}

/**
 * Retrieves the registered private key for a given agent address if known.
 */
export function getAgentPrivateKey(address: string): `0x${string}` | null {
  if (!address) return null;
  const normalized = address.trim().toLowerCase();
  const keys = loadKeys();
  const key = keys[normalized];
  if (key && key.startsWith("0x") && key.length === 66) {
    return key as `0x${string}`;
  }
  return null;
}

/**
 * Registers a private key for an agent address.
 */
export function setAgentPrivateKey(address: string, privateKey: string): boolean {
  if (!address || !privateKey) return false;
  const cleanKey = privateKey.trim();
  const formattedKey = cleanKey.startsWith("0x") ? cleanKey : `0x${cleanKey}`;
  if (formattedKey.length !== 66) return false;

  try {
    const derivedAccount = privateKeyToAccount(formattedKey as `0x${string}`);
    const normalized = address.trim().toLowerCase();
    
    // Store under both the requested address and the derived address
    const keys = loadKeys();
    keys[normalized] = formattedKey;
    keys[derivedAccount.address.toLowerCase()] = formattedKey;
    saveKeys(keys);
    return true;
  } catch (err) {
    console.error("[AgentKeys] Failed to validate private key:", err);
    return false;
  }
}

/**
 * Checks if the backend has an active private key to sign on behalf of this agent.
 */
export function hasAgentPrivateKey(address: string): boolean {
  return !!getAgentPrivateKey(address);
}

/**
 * Gets the viem PrivateKeyAccount for an agent.
 */
export function getAgentAccount(address: string) {
  const pk = getAgentPrivateKey(address);
  if (!pk) return null;
  try {
    return privateKeyToAccount(pk);
  } catch {
    return null;
  }
}

/**
 * Gets a WalletClient configured with the agent's private key on Arc Testnet.
 */
export function getAgentWalletClient(address: string) {
  const account = getAgentAccount(address);
  if (!account) return null;

  return createWalletClient({
    account,
    chain: arcTestnetChain,
    transport: http(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"),
  });
}
