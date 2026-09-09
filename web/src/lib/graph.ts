/**
 * The Graph Client & Standardized Financial Queries
 * Connects to Float Subgraph and external Agent0 / ERC-8004 subgraphs.
 */

const FLOAT_SUBGRAPH_URL = process.env.FLOAT_SUBGRAPH_URL || "";
const AGENT0_SUBGRAPH_URL = process.env.AGENT0_SUBGRAPH_URL || "";

export const AGENT_FINANCIAL_PROFILE_QUERY = `
  query GetAgentFinancialProfile($agentAddress: ID!) {
    agent(id: $agentAddress) {
      id
      agentAddress
      humanOwner
      name
      isActive
      registeredAt
      financialProfile {
        totalBorrowed
        totalRepaid
        outstandingDebt
        creditLimit
        creditUtilizationBps
        borrowCount
        repaymentCount
      }
      borrows(first: 10, orderBy: timestamp, orderDirection: desc) {
        id
        amount
        outstandingDebtAfter
        timestamp
        transactionHash
      }
      repayments(first: 10, orderBy: timestamp, orderDirection: desc) {
        id
        amount
        remainingDebt
        timestamp
        transactionHash
      }
    }
  }
`;

export async function fetchAgentFromGraph(agentAddress: string) {
  if (!FLOAT_SUBGRAPH_URL) {
    console.warn("FLOAT_SUBGRAPH_URL not configured, returning null");
    return null;
  }

  try {
    const response = await fetch(FLOAT_SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: AGENT_FINANCIAL_PROFILE_QUERY,
        variables: { agentAddress: agentAddress.toLowerCase() },
      }),
    });

    const result = await response.json();
    return result.data?.agent || null;
  } catch (err) {
    console.error("Error querying The Graph:", err);
    return null;
  }
}
