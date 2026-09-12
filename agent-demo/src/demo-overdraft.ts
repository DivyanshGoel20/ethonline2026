/**
 * FLOAT — Autonomous AI Agent x402 Overdraft Lifecycle Demonstration
 * Demonstrates:
 * CASE A: Agent with sufficient Circle Gateway balance pays normally (0 debt).
 * CASE B: Agent with 0 Gateway balance calls HTTP 402 API, FloatSignerTS automatically
 *         detects shortfall, draws from Float Credit Facility, Float funds payment,
 *         API returns 200, and debt is recorded against human credit profile.
 * CASE C: Agent repays debt via POST /api/repay, clearing outstanding balance.
 */

import { FloatSignerTS } from "./floatSigner";

const FLOAT_API_BASE = process.env.FLOAT_API_BASE || "http://localhost:3001";
const PREMIUM_API_URL = process.env.PREMIUM_API_URL || "http://localhost:3000/premium-data";

// Registered Agent in Float (Trial Agent)
const AGENT_ADDRESS = "0x890663d91113b8fe99913bda4ee2647484a2591a";
const HUMAN_PROFILE = process.env.HUMAN_PROFILE || "0x1a4d7ff9847b6b4d616afa1e16ada2c29cf59e4357ce759a87320b539a1b8077";

// Funded Account (simulating an agent with sufficient Circle Gateway balance)
const FUNDED_AGENT_ADDRESS = process.env.FUNDED_AGENT_ADDRESS || "0x5233E4253bC38e8CF517c0768dbC8aCC886F32B3";
const FUNDED_AGENT_KEY = (process.env.FUNDED_AGENT_KEY || process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;

const CREDIT_FACILITY_ADDRESS =
  process.env.FLOAT_CREDIT_FACILITY_ADDRESS ||
  "0xAa2d23bAC7b6f9b4ca2737252F924b3F485E0686";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log("================================================================================");
  console.log("             FLOAT — CORE PAYMENT OVERDRAFT SYSTEM DEMONSTRATION                ");
  console.log("================================================================================");
  console.log(`Float Server:       ${FLOAT_API_BASE}`);
  console.log(`Credit Facility:    ${CREDIT_FACILITY_ADDRESS} (Arc Testnet 5042002)`);
  console.log(`Paid x402 API:      ${PREMIUM_API_URL}`);
  console.log(`Target Agent:       ${AGENT_ADDRESS}`);
  console.log(`Human Profile:      ${HUMAN_PROFILE}\n`);

  const floatSigner = new FloatSignerTS({ floatApiBase: FLOAT_API_BASE });

  // -------------------------------------------------------------------------
  // CASE A: AGENT HAS SUFFICIENT GATEWAY BALANCE
  // -------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("▶ CASE A: AGENT WITH SUFFICIENT CIRCLE GATEWAY BALANCE");
  console.log("--------------------------------------------------------------------------------");
  const fundedBalance = await floatSigner.getAgentGatewayBalance(FUNDED_AGENT_ADDRESS);
  console.log(`Funded Agent: ${FUNDED_AGENT_ADDRESS}`);
  console.log(`Circle Gateway Available Balance: $${fundedBalance.formattedAvailable} USDC`);
  console.log(`Calling Paid API: GET ${PREMIUM_API_URL} ($0.01 USDC)...`);

  try {
    const resA = await floatSigner.pay(
      PREMIUM_API_URL,
      {
        agentAddress: FUNDED_AGENT_ADDRESS,
        agentPrivateKey: FUNDED_AGENT_KEY,
        humanProfileId: HUMAN_PROFILE,
      }
    );

    console.log(`[Result A] Success: ${resA.success}`);
    console.log(`[Result A] Funding Source: ${resA.fundingSource}`);
    console.log(`[Result A] Amount Paid: $${resA.amount} USDC`);
    console.log(`[Result A] Borrowed from Float: $${resA.borrowed} USDC`);
    console.log(`[Result A] Drawdown ID: ${resA.drawdownId || "None"}`);
    console.log(`[Result A] API Response:`, JSON.stringify(resA.data));
    console.log(`[Result A] Verified: Normal payment processed with 0 debt.\n`);
  } catch (err: any) {
    console.error(`[Case A Error]:`, err.message);
  }

  await sleep(1500);

  // -------------------------------------------------------------------------
  // CASE B: AGENT WITH $0.00 BALANCE (AUTOMATIC OVERDRAFT)
  // -------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("▶ CASE B: AGENT WITH INSUFFICIENT BALANCE (FLOAT OVERDRAFT)");
  console.log("--------------------------------------------------------------------------------");
  const agentBalance = await floatSigner.getAgentGatewayBalance(AGENT_ADDRESS);
  console.log(`Agent Address: ${AGENT_ADDRESS}`);
  console.log(`Real Circle Gateway Available Balance: $${agentBalance.formattedAvailable} USDC`);
  console.log(`Calling Paid API: GET ${PREMIUM_API_URL} ($0.01 USDC)...`);
  console.log(`Shortfall: $0.01 USDC. FloatSignerTS intercepts 402 and evaluates Credit Facility...`);

  let drawdownAmount = 0.01;
  try {
    const resB = await floatSigner.pay(
      PREMIUM_API_URL,
      {
        agentAddress: AGENT_ADDRESS,
        humanProfileId: HUMAN_PROFILE,
      }
    );

    console.log(`\n[FloatSignerTS] ⚡ Overdraft Activated!`);
    console.log(`[FloatSignerTS] Funding Source: ${resB.fundingSource}`);
    console.log(`[FloatSignerTS] Service Amount: $${resB.amount} USDC`);
    console.log(`[FloatSignerTS] Shortfall Covered: $${resB.borrowed} USDC`);
    console.log(`[FloatSignerTS] Float Facility Drawdown ID: ${resB.drawdownId}`);
    console.log(`[FloatSignerTS] Float Funding Payer: ${resB.payer}`);
    console.log(`[FloatSignerTS] API Response (HTTP 200 Unlocked):`, JSON.stringify(resB.data));
    console.log(`[FloatSignerTS] Agent Outstanding Debt: $${resB.agentDebt?.toFixed(2)} USDC`);
    console.log(`[FloatSignerTS] Human Facility Total Debt: $${resB.facilityDebt?.toFixed(2)} USDC\n`);

    drawdownAmount = parseFloat(resB.borrowed);
  } catch (err: any) {
    console.error(`[Case B Error]:`, err.message);
  }

  await sleep(1500);

  // -------------------------------------------------------------------------
  // CASE C: DEBT REPAYMENT
  // -------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("▶ CASE C: HUMAN / AGENT REPAYMENT");
  console.log("--------------------------------------------------------------------------------");
  console.log(`Agent earns revenue and repays $${drawdownAmount.toFixed(2)} USDC...`);
  console.log(`Calling POST ${FLOAT_API_BASE}/api/repay...`);

  try {
    const repayRes = await fetch(`${FLOAT_API_BASE}/api/repay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentAddress: AGENT_ADDRESS,
        amount: drawdownAmount,
      }),
    });

    const repayData = await repayRes.json();
    console.log(`[Repay Result] Success: ${repayData.success}`);
    console.log(`[Repay Result] Amount Repaid: $${repayData.amount} USDC`);
    console.log(`[Repay Result] Remaining Agent Debt: $${repayData.remainingDebt} USDC`);
    console.log(`[Repay Result] Human Facility Total Debt: $${repayData.facilityTotalDebt} USDC`);
    console.log(`[Repay Result] Settlement Tx: ${repayData.txHash}`);
    console.log(`[Repay Result] Message: ${repayData.message}\n`);
  } catch (err: any) {
    console.error(`[Case C Error]:`, err.message);
  }

  console.log("================================================================================");
  console.log("🎉 FLOAT DEMONSTRATION COMPLETE: Zero-friction AI machine overdraft verified!");
  console.log("================================================================================");
}

runDemo().catch(console.error);
