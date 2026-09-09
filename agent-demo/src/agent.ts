/**
 * Autonomous AI Agent Simulator for Float
 * Demonstrates how an agent facing an HTTP 402 shortfall accesses Float credit on Arc,
 * executes its payment, delivers its service, earns revenue, and repays its debt.
 */

const FLOAT_API_BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const MOCK_SERVICE_URL = `http://localhost:${process.env.MOCK_SERVICE_PORT || 4020}/api/market-data`;

// Simulated Agent Profile
const AGENT_ADDRESS = "0x2222222222222222222222222222222222222222";
let agentWalletBalanceUSDC = 4.0; // Agent has only $4 liquid USDC

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAgentLifecycle() {
  console.log("==================================================================");
  console.log("🤖 Float AI Agent Autonomous Lifecycle Demo");
  console.log(`Agent Address: ${AGENT_ADDRESS}`);
  console.log(`Initial Agent Liquid Balance: $${agentWalletBalanceUSDC.toFixed(2)} USDC`);
  console.log("==================================================================\n");

  await sleep(1000);

  // Step 1: Agent calls paid external service
  console.log(`[Agent] Calling data provider: ${MOCK_SERVICE_URL}`);
  let response = await fetch(MOCK_SERVICE_URL);

  if (response.status === 402) {
    const errorBody = await response.json();
    const priceNeeded = parseFloat(errorBody.amountDueUSDC || "12.00");
    console.log(`[Agent] ⚠️ Received HTTP 402 Payment Required! Price: $${priceNeeded.toFixed(2)} USDC`);
    console.log(`[Agent] Current balance: $${agentWalletBalanceUSDC.toFixed(2)} USDC. Shortfall: $${(priceNeeded - agentWalletBalanceUSDC).toFixed(2)} USDC`);

    const borrowAmount = (priceNeeded - agentWalletBalanceUSDC).toFixed(2);

    // Step 2: Agent calls Float Credit Borrow API
    console.log(`\n[Agent] 🚀 Requesting temporary credit of $${borrowAmount} USDC from Float Borrow API...`);
    try {
      const borrowRes = await fetch(`${FLOAT_API_BASE}/api/agent/borrow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentAddress: AGENT_ADDRESS,
          amount: borrowAmount
        })
      });

      if (borrowRes.ok) {
        const borrowData = await borrowRes.json();
        console.log(`[Float] ✅ Credit line approved! Tx: ${borrowData.txHash || "0xarc_settled"}`);
        agentWalletBalanceUSDC += parseFloat(borrowAmount);
        console.log(`[Agent] Liquid balance updated to: $${agentWalletBalanceUSDC.toFixed(2)} USDC`);
      } else {
        console.log(`[Float] Mock credit fallback applied for local demo.`);
        agentWalletBalanceUSDC += parseFloat(borrowAmount);
      }
    } catch (err) {
      console.log(`[Float API Offline] Simulating approved borrow of $${borrowAmount} USDC`);
      agentWalletBalanceUSDC += parseFloat(borrowAmount);
    }

    await sleep(1000);

    // Step 3: Agent executes payment to x402 service
    console.log(`\n[Agent] 💳 Executing payment of $${priceNeeded.toFixed(2)} USDC using Arc Nanopayment authorization...`);
    agentWalletBalanceUSDC -= priceNeeded;

    response = await fetch(MOCK_SERVICE_URL, {
      headers: {
        "X-Nanopayment-Authorization": `arc_auth_sig_${Date.now()}`
      }
    });

    const serviceData = await response.json();
    console.log(`[Agent] 🎯 Success! Data received:`, serviceData.data);

    await sleep(1500);

    // Step 4: Agent completes task and earns revenue
    const revenueEarned = 30.0;
    agentWalletBalanceUSDC += revenueEarned;
    console.log(`\n[Agent] 💰 Agent finished research task and received client revenue: +$${revenueEarned.toFixed(2)} USDC!`);
    console.log(`[Agent] Wallet balance now: $${agentWalletBalanceUSDC.toFixed(2)} USDC`);

    await sleep(1000);

    // Step 5: Agent repays Float credit line
    console.log(`\n[Agent] 🔄 Calling Float Repay API to settle outstanding $${borrowAmount} debt...`);
    try {
      const repayRes = await fetch(`${FLOAT_API_BASE}/api/agent/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentAddress: AGENT_ADDRESS,
          amount: borrowAmount
        })
      });

      if (repayRes.ok) {
        const repayData = await repayRes.json();
        console.log(`[Float] ✅ Repayment settled on Arc! Debt cleared. Tx: ${repayData.txHash || "0xarc_repay_settled"}`);
      } else {
        console.log(`[Float] Repayment registered in local state.`);
      }
    } catch {
      console.log(`[Float] Repayment logged in offline state.`);
    }

    agentWalletBalanceUSDC -= parseFloat(borrowAmount);
    console.log(`\n🎉 Lifecycle Complete! Final Agent Balance: $${agentWalletBalanceUSDC.toFixed(2)} USDC. Credit facility fully restored.`);
  }
}

runAgentLifecycle().catch(console.error);
