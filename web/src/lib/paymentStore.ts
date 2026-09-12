import fs from "fs";
import path from "path";

export interface PaymentRecord {
  paymentId: string;
  agentAddress: string;
  humanProfileId: string;
  sellerAddress: string;
  resourceUrl: string;
  requestedAmount: string; // e.g. "0.01"
  agentGatewayBalance: string; // e.g. "0.00"
  shortfall: string; // e.g. "0.01"
  fundingSource: "AGENT_GATEWAY" | "FLOAT_FACILITY";
  drawdownId: string | null;
  status: "SUCCESS" | "FAILED" | "REJECTED_CREDIT";
  timestamp: number;
  transactionId?: string;
  memo?: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const PAYMENTS_FILE = path.join(DATA_DIR, "payments.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getAllPayments(): PaymentRecord[] {
  try {
    ensureDirectoryExists();
    if (!fs.existsSync(PAYMENTS_FILE)) {
      return [];
    }
    const content = fs.readFileSync(PAYMENTS_FILE, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("[PaymentStore] Error reading payments file:", error);
    return [];
  }
}

export function saveAllPayments(payments: PaymentRecord[]) {
  try {
    ensureDirectoryExists();
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2), "utf8");
  } catch (error) {
    console.error("[PaymentStore] Error writing payments file:", error);
  }
}

export function recordPayment(payment: PaymentRecord): PaymentRecord {
  const all = getAllPayments();
  all.unshift(payment);
  saveAllPayments(all);
  return payment;
}

export function getPaymentsByAgent(agentAddress: string): PaymentRecord[] {
  const all = getAllPayments();
  return all.filter(
    (p) => p.agentAddress.toLowerCase() === agentAddress.toLowerCase()
  );
}

export function getPaymentsByHuman(humanProfileId: string): PaymentRecord[] {
  const all = getAllPayments();
  return all.filter(
    (p) => p.humanProfileId.toLowerCase() === humanProfileId.toLowerCase()
  );
}
