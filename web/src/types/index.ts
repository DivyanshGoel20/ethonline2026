export interface Agent {
  agentId?: string;
  address: `0x${string}`;
  name: string;
  humanOwner: string;
  network?: string;
  purpose?: string;
  apiKey?: string;
  isPlatformCreated?: boolean;
  isWorldBacked?: boolean;
  agentBookStatus?: "VERIFIED" | "UNVERIFIED";
  agentBookHumanId?: string; // Stored internally, omitted in client UI
  agentBookTxHash?: string;  // World Chain AgentBook registration tx hash
  creditLimit: number;       // in USDC
  outstandingDebt: number;   // in USDC
  totalBorrowed: number;     // in USDC
  totalRepaid: number;       // in USDC
  currentBalance: number;    // in USDC
  gatewayBalanceUSDC?: string; // Live Circle Gateway available USDC
  status: "Healthy" | "Active" | "Delinquent" | "Suspended";
  registeredAt: number;
}

export interface CreditStats {
  totalAvailableCredit: number;
  totalCreditUsed: number;
  totalOutstandingDebt: number;
  totalBorrowed: number;
  totalRepaid: number;
  activeAgentsCount: number;
}

export interface ActivityItem {
  id: string;
  type: "borrow" | "repay" | "register" | "remove" | "x402_overdraft" | "x402_normal";
  agentName: string;
  agentAddress: string;
  amount?: number;
  timestamp: number;
  txHash: string;
}

export interface Loan {
  loanId: string;
  agentAddress: string;
  agentName: string;
  humanOwner: string;
  amount: number;
  outstandingAmount: number;
  totalRepaid: number;
  status: "ACTIVE" | "SETTLED" | "DEFAULTED";
  borrowedAt: number;
  settledAt?: number;
  borrowTxHash: string;
  repayTxHashes: string[];
  memo?: string;
}

export interface BorrowRequest {
  agentAddress: string;
  amount: string | number;
  memo?: string;
  signature?: string;
  nonce?: string;
}

export interface BorrowResponse {
  success: boolean;
  loanId?: string;
  txHash?: string;
  amount: number;
  newOutstandingDebt: number;
  facilityTotalDebt?: number;
  agentAddress: string;
  humanOwner?: string;
  error?: string;
}

export interface RepayRequest {
  agentAddress: string;
  amount: string | number;
  targetAgentAddress?: string;
  targetLoanId?: string;
  txHash?: string;
}

export interface RepayResponse {
  success: boolean;
  txHash?: string;
  amount: number;
  remainingDebt: number;
  refundExcess?: number;
  agentAddress: string;
  beneficiaryAgentAddress?: string;
  facilityTotalDebt?: number;
  settledLoans?: string[];
  error?: string;
}

