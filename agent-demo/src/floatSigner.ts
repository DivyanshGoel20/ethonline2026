import { GatewayClient } from "@circle-fin/x402-batching/client";
import { formatUnits } from "viem";

export interface AgentPaymentContext {
  agentAddress: string;
  agentPrivateKey?: `0x${string}`;
  humanProfileId?: string;
  floatApiBase?: string;
}

export interface FloatPayResult {
  success: boolean;
  fundingSource: "AGENT_GATEWAY" | "FLOAT_FACILITY";
  amount: string;
  borrowed: string;
  drawdownId: string | null;
  agentGatewayBalance: string;
  shortfall: string;
  data: any;
  status: number;
  transactionId?: string;
  payer: string;
  agentDebt?: number;
  facilityDebt?: number;
}

export class FloatSignerTS {
  private floatFundingClient: GatewayClient;
  private fundingPrivateKey: `0x${string}`;
  private floatApiBase: string;

  constructor(options?: {
    fundingPrivateKey?: `0x${string}`;
    chain?: "arcTestnet";
    floatApiBase?: string;
  }) {
    this.floatApiBase =
      options?.floatApiBase ||
      process.env.FLOAT_API_BASE ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3001";

    this.fundingPrivateKey =
      options?.fundingPrivateKey ||
      (process.env.FLOAT_FUNDING_PRIVATE_KEY as `0x${string}`) ||
      (process.env.PRIVATE_KEY as `0x${string}`);

    if (!this.fundingPrivateKey) {
      throw new Error("Missing FLOAT_FUNDING_PRIVATE_KEY or PRIVATE_KEY in environment");
    }

    this.floatFundingClient = new GatewayClient({
      chain: options?.chain || "arcTestnet",
      privateKey: this.fundingPrivateKey,
    });
  }

  get fundingAddress(): string {
    return this.floatFundingClient.address;
  }

  async getAgentGatewayBalance(
    agentAddress: string
  ): Promise<{ available: bigint; formattedAvailable: string }> {
    const balances = await (this.floatFundingClient as any).getGatewayBalance(
      agentAddress
    );
    return {
      available: balances.available,
      formattedAvailable: balances.formattedAvailable,
    };
  }

  async pay(
    url: string,
    agentContext: AgentPaymentContext,
    options?: {
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: any;
    }
  ): Promise<FloatPayResult> {
    const apiBase = agentContext.floatApiBase || this.floatApiBase;

    // Delegate to Float API for atomic credit facility check, drawdown, and payment execution
    const res = await fetch(`${apiBase}/api/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        agentAddress: agentContext.agentAddress,
        agentPrivateKey: agentContext.agentPrivateKey,
        humanProfileId: agentContext.humanProfileId,
        method: options?.method || "GET",
        body: options?.body,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Payment execution failed");
    }

    return data as FloatPayResult;
  }
}
