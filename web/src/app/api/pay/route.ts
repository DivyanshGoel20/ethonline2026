import { NextRequest, NextResponse } from "next/server";
import { FloatSignerTS } from "@/lib/floatSigner";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, agentAddress, agentPrivateKey, humanProfileId, method, body: reqBody } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: url" },
        { status: 400 }
      );
    }

    if (!agentAddress) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: agentAddress" },
        { status: 400 }
      );
    }

    const floatSigner = new FloatSignerTS();

    const result = await floatSigner.pay(
      url,
      {
        agentAddress,
        agentPrivateKey,
        humanProfileId,
      },
      {
        method: method || "GET",
        body: reqBody,
      }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[POST /api/pay] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "FloatSigner payment execution failed",
      },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentAddress =
      searchParams.get("agentAddress") || searchParams.get("address");

    if (!agentAddress) {
      return NextResponse.json(
        { error: "Missing required parameter: agentAddress" },
        { status: 400 }
      );
    }

    const floatSigner = new FloatSignerTS();
    const balance = await floatSigner.getAgentGatewayBalance(agentAddress);

    return NextResponse.json({
      agentAddress,
      gatewayAvailableUSDC: balance.formattedAvailable,
      floatFundingAddress: floatSigner.fundingAddress,
      creditFacilityAddress: floatSigner.creditFacilityAddress,
    });
  } catch (error: any) {
    console.error("[GET /api/pay] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to query Gateway balance" },
      { status: 500 }
    );
  }
}
