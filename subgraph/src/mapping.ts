import { BigInt } from "@graphprotocol/graph-ts";

// Placeholder handler signatures for Subgraph codegen compilation
// Full types will be populated when graph codegen runs against compiled ABI.

export function handleAgentRegistered(): void {
  // 1. Create or update Agent entity
  // 2. Initialize empty FinancialProfile entity
}

export function handleBorrowCreated(): void {
  // 1. Create immutable BorrowRecord entity
  // 2. Increment totalBorrowed and update outstandingDebt in FinancialProfile
  // 3. Create outgoing PaymentActivity record
}

export function handleRepaymentMade(): void {
  // 1. Create immutable RepayRecord entity
  // 2. Increment totalRepaid and decrement outstandingDebt in FinancialProfile
  // 3. Create incoming PaymentActivity record
}

export function handleCreditLimitUpdated(): void {
  // 1. Update creditLimit and recompute creditUtilizationBps in FinancialProfile
}

export function handleCreditStatusChanged(): void {
  // 1. Update isActive on Agent entity
}
