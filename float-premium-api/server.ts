import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { formatUnits } from "viem";

type PaidRequest = express.Request & {
  payment?: {
    verified: boolean;
    payer: string;
    amount: string;
    network: string;
    transaction?: string;
  };
};

const app = express();

const SELLER_WALLET =
  process.env.SELLER_WALLET_ADDRESS ||
  "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://gateway-api-testnet.circle.com";
const PORT = process.env.PORT || 3000;

const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_WALLET,
  facilitatorUrl: FACILITATOR_URL,
});

app.get(
  "/premium-data",
  gateway.require("$0.01"),
  (req: PaidRequest, res) => {
    const { payer, amount, network } = req.payment!;

    res.json({
      success: true,
      message: "Premium data unlocked.",
      data: {
        signal: "DEMO-ALPHA-001",
        value: 8472,
      },
      payment: {
        payer,
        amount: formatUnits(BigInt(amount), 6) + " USDC",
        network,
      },
    });
  }
);

app.listen(PORT, () => {
  console.log(`Float Premium API running on http://localhost:${PORT}`);
});
