import { NextRequest, NextResponse } from "next/server";
import { Agent } from "@/types";
import { getAllAgents, addAgentToStore, getAgentsByOwner, removeAgentFromStore } from "@/lib/agentStore";
import { validateArcAgentWallet } from "@/lib/arc";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");

    const agents = owner ? getAgentsByOwner(owner) : getAllAgents();

    return NextResponse.json({
      agents,
      totalCount: agents.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, walletAddress, humanOwner } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Agent name is required." },
        { status: 400 }
      );
    }

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Agent wallet address is required." },
        { status: 400 }
      );
    }

    // Strict Arc Testnet validation
    const validation = await validateArcAgentWallet(walletAddress);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "This address is not a valid/usable Arc Testnet agent wallet." },
        { status: 400 }
      );
    }

    const formattedAddress = walletAddress.trim().toLowerCase() as `0x${string}`;

    const newAgent: Agent = {
      agentId: `agent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      address: formattedAddress,
      name: name.trim(),
      humanOwner: humanOwner || "anonymous_human",
      network: "Arc Testnet (5042002)",
      creditLimit: 500,
      outstandingDebt: 0,
      totalBorrowed: 0,
      totalRepaid: 0,
      currentBalance: validation.balanceUsdc || 0,
      status: "Healthy",
      registeredAt: Date.now(),
    };

    const saved = addAgentToStore(newAgent);

    return NextResponse.json({
      success: true,
      agent: saved,
      message: `Agent ${saved.name} verified on Arc Testnet and registered to credit facility.`,
    });
  } catch (error: any) {
    console.error("[Agents-API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process agent request" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Agent address is required." },
        { status: 400 }
      );
    }

    const all = getAllAgents();
    const existing = all.find(
      (a) => a.address.toLowerCase() === address.toLowerCase()
    );

    if (!existing) {
      return NextResponse.json(
        { error: "Agent not found in Float registry." },
        { status: 404 }
      );
    }

    // Check if agent has unsettled debt
    if (existing.outstandingDebt > 0) {
      return NextResponse.json(
        {
          error: `Cannot remove agent with an active credit draw ($${existing.outstandingDebt.toFixed(2)} USDC). Please repay the debt before removing.`,
        },
        { status: 403 }
      );
    }

    const removed = removeAgentFromStore(address);
    if (!removed) {
      return NextResponse.json(
        { error: "Failed to remove agent from registry." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Agent ${existing.name} disconnected from Float credit facility.`,
    });
  } catch (error: any) {
    console.error("[Agents-API] Delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove agent" },
      { status: 500 }
    );
  }
}
