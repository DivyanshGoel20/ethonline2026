export interface Agent {
  agentId?: string;
  address: `0x${string}`;
  name: string;
  humanOwner: string;
  network?: string;
  purpose?: string;
  apiKey?: string;
  isPlatformCreated?: boolean;
  creditLimit: number;       // in USDC
  outstandingDebt: number;   // in USDC
  totalBorrowed: number;     // in USDC
  totalRepaid: number;       // in USDC
  currentBalance: number;    // in USDC
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
  type: "borrow" | "repay" | "register" | "remove";
  agentName: string;
  agentAddress: string;
  amount?: number;
  timestamp: number;
  txHash: string;
}

export interface BorrowRequest {
  agentAddress: string;
  amount: string | number;
  signature?: string;
  nonce?: string;
}

export interface BorrowResponse {
  success: boolean;
  txHash?: string;
  amount: number;
  newOutstandingDebt: number;
  agentAddress: string;
  error?: string;
}

export interface RepayRequest {
  agentAddress: string;
  amount: string | number;
  txHash?: string;
}

export interface RepayResponse {
  success: boolean;
  txHash?: string;
  amount: number;
  remainingDebt: number;
  agentAddress: string;
  error?: string;
}
