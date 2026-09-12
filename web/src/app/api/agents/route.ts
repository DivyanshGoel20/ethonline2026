import { NextRequest, NextResponse } from "next/server";
import { Agent } from "@/types";
import { getAllAgents, addAgentToStore, getAgentsByOwner, removeAgentFromStore } from "@/lib/agentStore";
import { validateArcAgentWallet } from "@/lib/arc";
import { resolveAgentBookStatus } from "@/lib/agentKit";
import { FloatSignerTS } from "@/lib/floatSigner";
import { syncAgentToContractOnChain } from "@/lib/facilityContract";

function sanitizeAgentForClient(agent: Agent): Agent {
  // Strip out internal agentBookHumanId to protect human privacy in UI
  const { agentBookHumanId, ...rest } = agent;
  return rest as Agent;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");

    const rawAgents = owner ? getAgentsByOwner(owner) : getAllAgents();

    // Query live Circle Gateway balance for each registered agent
    let floatSigner: FloatSignerTS | null = null;
    try {
      floatSigner = new FloatSignerTS();
    } catch (e) {
      console.warn("Could not initialize FloatSignerTS for balance queries:", e);
    }

    const enrichedAgents = await Promise.all(
      rawAgents.map(async (agent) => {
        let liveGw = (agent.currentBalance || 0).toFixed(2);
        if (floatSigner) {
          try {
            const bal = await floatSigner.getAgentGatewayBalance(agent.address);
            liveGw = bal.formattedAvailable;
          } catch (err) {
            // fallback to stored balance
          }
        }
        return {
          ...agent,
          currentBalance: parseFloat(liveGw) || 0,
          gatewayBalanceUSDC: liveGw,
        };
      })
    );

    const agents = enrichedAgents.map(sanitizeAgentForClient);

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

    // AgentKit AgentBook verification on World Chain
    const agentBookInfo = await resolveAgentBookStatus(formattedAddress);

    const newAgent: Agent = {
      agentId: `agent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      address: formattedAddress,
      name: name.trim(),
      humanOwner: humanOwner || "anonymous_human",
      network: "Arc Testnet (5042002)",
      creditLimit: 10,
      outstandingDebt: 0,
      totalBorrowed: 0,
      totalRepaid: 0,
      currentBalance: validation.balanceUsdc || 0,
      status: "Healthy",
      registeredAt: Date.now(),
      isWorldBacked: agentBookInfo.isWorldBacked,
      agentBookStatus: agentBookInfo.agentBookStatus,
      agentBookHumanId: agentBookInfo.humanId || undefined,
    };

    const saved = addAgentToStore(newAgent);

    // Synchronize agent authorization and profile creation to Arc Testnet contract
    try {
      await syncAgentToContractOnChain(newAgent.address, newAgent.humanOwner);
    } catch (contractErr: any) {
      console.warn("[Agents-API] On-chain agent authorization notice:", contractErr.message || contractErr);
    }

    return NextResponse.json({
      success: true,
      agent: sanitizeAgentForClient(saved),
      agentBookStatus: agentBookInfo.agentBookStatus,
      isWorldBacked: agentBookInfo.isWorldBacked,
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
