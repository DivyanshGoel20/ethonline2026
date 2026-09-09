import fs from "fs";
import path from "path";
import { Agent } from "@/types";

const DATA_DIR = path.resolve(process.cwd(), "data");
const AGENTS_FILE = path.join(DATA_DIR, "agents.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getAllAgents(): Agent[] {
  try {
    ensureDirectoryExists();
    if (!fs.existsSync(AGENTS_FILE)) {
      return [];
    }
    const content = fs.readFileSync(AGENTS_FILE, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("[AgentStore] Error reading agents file:", error);
    return [];
  }
}

export function saveAllAgents(agents: Agent[]) {
  try {
    ensureDirectoryExists();
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2), "utf8");
  } catch (error) {
    console.error("[AgentStore] Error writing agents file:", error);
  }
}

export function getAgentsByOwner(owner?: string): Agent[] {
  const all = getAllAgents();
  if (!owner) return all;
  return all.filter((a) => a.humanOwner?.toLowerCase() === owner.toLowerCase());
}

export function addAgentToStore(newAgent: Agent): Agent {
  const all = getAllAgents();
  // Check if wallet address already exists
  const existingIndex = all.findIndex(
    (a) => a.address.toLowerCase() === newAgent.address.toLowerCase()
  );

  if (existingIndex >= 0) {
    all[existingIndex] = { ...all[existingIndex], ...newAgent };
    saveAllAgents(all);
    return all[existingIndex];
  }

  all.unshift(newAgent);
  saveAllAgents(all);
  return newAgent;
}

export function updateAgentInStore(
  address: string,
  updates: Partial<Agent>
): Agent | null {
  const all = getAllAgents();
  const index = all.findIndex(
    (a) => a.address.toLowerCase() === address.toLowerCase()
  );

  if (index === -1) return null;

  all[index] = { ...all[index], ...updates };
  saveAllAgents(all);
  return all[index];
}

export function getAgentByAddress(address: string): Agent | null {
  const all = getAllAgents();
  return (
    all.find((a) => a.address.toLowerCase() === address.toLowerCase()) || null
  );
}

export function getHumanFacilityStats(humanOwner: string): {
  humanOwner: string;
  agentCount: number;
  totalCreditLimit: number;
  totalOutstandingDebt: number;
  totalAvailableCredit: number;
  totalBorrowed: number;
  totalRepaid: number;
} {
  const humanAgents = getAgentsByOwner(humanOwner);
  const totalCreditLimit = 500; // World ID Selfie Check backed credit line
  const totalOutstandingDebt = humanAgents.reduce(
    (sum, a) => sum + (a.outstandingDebt || 0),
    0
  );
  const totalBorrowed = humanAgents.reduce(
    (sum, a) => sum + (a.totalBorrowed || 0),
    0
  );
  const totalRepaid = humanAgents.reduce(
    (sum, a) => sum + (a.totalRepaid || 0),
    0
  );
  const totalAvailableCredit = Math.max(
    0,
    totalCreditLimit - totalOutstandingDebt
  );

  return {
    humanOwner,
    agentCount: humanAgents.length,
    totalCreditLimit,
    totalOutstandingDebt,
    totalAvailableCredit,
    totalBorrowed,
    totalRepaid,
  };
}

export function removeAgentFromStore(address: string): boolean {
  const all = getAllAgents();
  const filtered = all.filter(
    (a) => a.address.toLowerCase() !== address.toLowerCase()
  );

  if (filtered.length === all.length) return false;

  saveAllAgents(filtered);
  return true;
}

