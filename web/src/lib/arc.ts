import { defineChain } from "viem";

/**
 * Arc Testnet Chain Definition
 */
export const arcTestnet = defineChain({
  id: process.env.ARC_CHAIN_ID ? parseInt(process.env.ARC_CHAIN_ID) : 5042,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [process.env.ARC_RPC_URL || "https://rpc.arc.io/testnet"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://scan.arc.io/testnet",
    },
  },
  testnet: true,
});

export const FLOAT_CONTRACTS = {
  creditManager: (process.env.NEXT_PUBLIC_FLOAT_CREDIT_MANAGER_ADDRESS || "0x1234567890123456789012345678901234567890") as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x07865c6e87b9f70255377e024ace6630c1eaa37f") as `0x${string}`,
};
