import fs from "fs";
import path from "path";
import { Loan } from "@/types";

const DATA_DIR = path.resolve(process.cwd(), "data");
const LOANS_FILE = path.join(DATA_DIR, "loans.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getAllLoans(): Loan[] {
  try {
    ensureDirectoryExists();
    if (!fs.existsSync(LOANS_FILE)) {
      return [];
    }
    const content = fs.readFileSync(LOANS_FILE, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("[LoanStore] Error reading loans file:", error);
    return [];
  }
}

export function saveAllLoans(loans: Loan[]) {
  try {
    ensureDirectoryExists();
    fs.writeFileSync(LOANS_FILE, JSON.stringify(loans, null, 2), "utf8");
  } catch (error) {
    console.error("[LoanStore] Error writing loans file:", error);
  }
}

export function getLoansByAgent(agentAddress: string): Loan[] {
  const all = getAllLoans();
  return all.filter(
    (l) => l.agentAddress.toLowerCase() === agentAddress.toLowerCase()
  );
}

export function getLoansByHuman(humanOwner: string): Loan[] {
  const all = getAllLoans();
  return all.filter(
    (l) => l.humanOwner.toLowerCase() === humanOwner.toLowerCase()
  );
}

export function getActiveLoansByHuman(humanOwner: string): Loan[] {
  const all = getAllLoans();
  return all.filter(
    (l) =>
      l.humanOwner.toLowerCase() === humanOwner.toLowerCase() &&
      l.status === "ACTIVE" &&
      l.outstandingAmount > 0
  );
}

export function createLoan(params: {
  agentAddress: string;
  agentName: string;
  humanOwner: string;
  amount: number;
  txHash: string;
  memo?: string;
}): Loan {
  const all = getAllLoans();

  const newLoan: Loan = {
    loanId: `loan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    agentAddress: params.agentAddress.toLowerCase(),
    agentName: params.agentName,
    humanOwner: params.humanOwner,
    amount: params.amount,
    outstandingAmount: params.amount,
    totalRepaid: 0,
    status: "ACTIVE",
    borrowedAt: Date.now(),
    borrowTxHash: params.txHash,
    repayTxHashes: [],
    memo: params.memo || "Float Credit Draw on Arc Testnet",
  };

  all.unshift(newLoan);
  saveAllLoans(all);
  return newLoan;
}

/**
 * Flexible repayment engine:
 * In Float, the Human is the actual borrower.
 * Therefore, any authorized agent can pay any loan or any sibling agent's debt under the same human owner.
 */
export function processRepayment(params: {
  payingAgentAddress: string;
  amount: number;
  targetAgentAddress?: string;
  targetLoanId?: string;
  humanOwner: string;
  txHash: string;
}): {
  amountRepaid: number;
  beneficiaryAgentAddress: string;
  settledLoans: string[];
  remainingExcessAmount: number;
} {
  const all = getAllLoans();
  let remainingToApply = params.amount;
  const settledLoans: string[] = [];
  const payingAddress = params.payingAgentAddress.toLowerCase();
  const targetAddress = params.targetAgentAddress
    ? params.targetAgentAddress.toLowerCase()
    : payingAddress;

  // 1. If a specific loan ID was targeted
  if (params.targetLoanId) {
    const loan = all.find((l) => l.loanId === params.targetLoanId);
    if (loan && loan.status === "ACTIVE" && loan.outstandingAmount > 0) {
      const payment = Math.min(remainingToApply, loan.outstandingAmount);
      loan.outstandingAmount -= payment;
      loan.totalRepaid += payment;
      loan.repayTxHashes.push(params.txHash);
      remainingToApply -= payment;

      if (loan.outstandingAmount <= 0) {
        loan.status = "SETTLED";
        loan.settledAt = Date.now();
        settledLoans.push(loan.loanId);
      }

      saveAllLoans(all);
      return {
        amountRepaid: params.amount - remainingToApply,
        beneficiaryAgentAddress: loan.agentAddress,
        settledLoans,
        remainingExcessAmount: remainingToApply,
      };
    }
  }

  // 2. Primary target: Repay active loans of the target agent (oldest first)
  const targetLoans = all
    .filter(
      (l) =>
        l.agentAddress.toLowerCase() === targetAddress &&
        l.status === "ACTIVE" &&
        l.outstandingAmount > 0
    )
    .sort((a, b) => a.borrowedAt - b.borrowedAt);

  for (const loan of targetLoans) {
    if (remainingToApply <= 0) break;
    const payment = Math.min(remainingToApply, loan.outstandingAmount);
    loan.outstandingAmount -= payment;
    loan.totalRepaid += payment;
    loan.repayTxHashes.push(params.txHash);
    remainingToApply -= payment;

    if (loan.outstandingAmount <= 0) {
      loan.status = "SETTLED";
      loan.settledAt = Date.now();
      settledLoans.push(loan.loanId);
    }
  }

  // 3. Shared Human Borrower Feature:
  // If excess payment remains, apply it to other active loans under the SAME human borrower!
  if (remainingToApply > 0 && params.humanOwner) {
    const otherHumanLoans = all
      .filter(
        (l) =>
          l.humanOwner.toLowerCase() === params.humanOwner.toLowerCase() &&
          l.agentAddress.toLowerCase() !== targetAddress &&
          l.status === "ACTIVE" &&
          l.outstandingAmount > 0
      )
      .sort((a, b) => a.borrowedAt - b.borrowedAt);

    for (const loan of otherHumanLoans) {
      if (remainingToApply <= 0) break;
      const payment = Math.min(remainingToApply, loan.outstandingAmount);
      loan.outstandingAmount -= payment;
      loan.totalRepaid += payment;
      loan.repayTxHashes.push(params.txHash);
      remainingToApply -= payment;

      if (loan.outstandingAmount <= 0) {
        loan.status = "SETTLED";
        loan.settledAt = Date.now();
        settledLoans.push(loan.loanId);
      }
    }
  }

  saveAllLoans(all);

  return {
    amountRepaid: params.amount - remainingToApply,
    beneficiaryAgentAddress: targetAddress,
    settledLoans,
    remainingExcessAmount: remainingToApply,
  };
}
