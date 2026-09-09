import { NextRequest, NextResponse } from "next/server";
import { Agent } from "@/types";

// Starter list of demo agents matching Section 5 in project.md
const INITIAL_AGENTS: Agent[] = [
  {
    address: "0x913a80277353f88f8d68bc3eefbb4806a6b878f2",
    name: "Research Agent",
    humanOwner: "0x1111111111111111111111111111111111111111",
    creditLimit: 500,
    outstandingDebt: 32,
    totalBorrowed: 120,
    totalRepaid: 88,
    currentBalance: 468,
    status: "Healthy",
    registeredAt: Date.now() - 86400000 * 3,
  },
  {
    address: "0x42f7c02b36a8e809311bc4c80b98024220b2491a",
    name: "Procurement Agent",
    humanOwner: "0x1111111111111111111111111111111111111111",
    creditLimit: 350,
    outstandingDebt: 180,
    totalBorrowed: 800,
    totalRepaid: 620,
    currentBalance: 170,
    status: "Active",
    registeredAt: Date.now() - 86400000 * 7,
  },
  {
    address: "0x2222222222222222222222222222222222222222",
    name: "x402 Market Agent",
    humanOwner: "0x1111111111111111111111111111111111111111",
    creditLimit: 500,
    outstandingDebt: 0,
    totalBorrowed: 0,
    totalRepaid: 0,
    currentBalance: 4,
    status: "Healthy",
    registeredAt: Date.now() - 3600000,
  }
];

export async function GET() {
  return NextResponse.json({
    agents: INITIAL_AGENTS,
    totalCount: INITIAL_AGENTS.length
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, agentAddress, name, signature } = body;

    // Challenge generation for Add Existing Agent
    if (action === "challenge") {
      const nonce = `float_challenge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return NextResponse.json({
        nonce,
        message: `Sign this challenge to prove ownership of agent wallet ${agentAddress} on Float at ${new Date().toISOString()}`
      });
    }

    // Add Agent flow
    if (action === "add" || action === "create") {
      const newAgent: Agent = {
        address: (agentAddress || `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`) as `0x${string}`,
        name: name || "Autonomous Agent",
        humanOwner: "0x1111111111111111111111111111111111111111",
        creditLimit: 300,
        outstandingDebt: 0,
        totalBorrowed: 0,
        totalRepaid: 0,
        currentBalance: 50,
        status: "Healthy",
        registeredAt: Date.now(),
      };

      return NextResponse.json({
        success: true,
        agent: newAgent,
        message: action === "add" ? "Agent ownership verified and registered" : "Platform agent created"
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
