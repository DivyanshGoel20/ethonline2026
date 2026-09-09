import { NextRequest, NextResponse } from "next/server";
import { verifyWorldSelfieProof } from "@/lib/world";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("[World-Verify] Incoming verification request:", JSON.stringify(body));
    const proofPayload = body.result || body.proof || body;

    const verification = await verifyWorldSelfieProof(proofPayload, body.signal);
    console.log("[World-Verify] Verification API response:", verification);

    if (!verification.success) {
      console.error("[World-Verify] Verification failed:", verification.error, verification.code);
      return NextResponse.json(
        { verified: false, error: verification.error, code: verification.code },
        { status: 400 }
      );
    }

    const nullifierHash =
      verification.nullifier ||
      proofPayload.nullifier ||
      proofPayload.nullifier_hash ||
      proofPayload.responses?.[0]?.nullifier ||
      `nullifier_${Date.now()}`;

    return NextResponse.json({
      verified: true,
      nullifierHash,
      verificationLevel: "selfie",
      message: "Human operator authenticated via World Selfie Check",
    });
  } catch (error: any) {
    console.error("[World-Verify] Handler exception:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process World ID verification" },
      { status: 500 }
    );
  }
}
