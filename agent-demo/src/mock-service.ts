import http from "http";

const PORT = process.env.MOCK_SERVICE_PORT ? parseInt(process.env.MOCK_SERVICE_PORT) : 4020;
const REQUIRED_PRICE_USDC = "12.00"; // $12.00 USDC

/**
 * Mock Paid API Service demonstrating HTTP 402 Payment Required
 * Matches Circle / Arc Nanopayments and x402 specification.
 */
const server = http.createServer((req, res) => {
  const paymentHeader = req.headers["x-nanopayment-authorization"] || req.headers["authorization"];

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/market-data") {
    // Check if valid payment authorization header was attached
    if (!paymentHeader) {
      console.log(`[Mock-x402-Service] Request received without payment. Responding with 402 Payment Required.`);
      res.writeHead(402, {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Nanopayment realm="arc-x402"',
        "X-Price-USDC": REQUIRED_PRICE_USDC,
        "X-Recipient-Address": "0x7777777777777777777777777777777777777777"
      });
      res.end(
        JSON.stringify({
          error: "Payment Required",
          statusCode: 402,
          amountDueUSDC: REQUIRED_PRICE_USDC,
          settlementChain: "arc-testnet",
          instructions: "Attach valid Arc/Circle Nanopayment signature in X-Nanopayment-Authorization header"
        })
      );
      return;
    }

    console.log(`[Mock-x402-Service] Valid Nanopayment received (${paymentHeader}). Fulfilling query.`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "success",
        data: {
          insight: "Real-time high-alpha market telemetry on Arc testnet",
          timestamp: Date.now(),
          pricePaidUSDC: REQUIRED_PRICE_USDC
        }
      })
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

server.listen(PORT, () => {
  console.log(`[Mock-x402-Service] Listening on http://localhost:${PORT}`);
  console.log(`[Mock-x402-Service] Endpoint: http://localhost:${PORT}/api/market-data (Costs $12.00 USDC)`);
});
