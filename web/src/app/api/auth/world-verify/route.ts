import { NextRequest, NextResponse } from "next/server";
import { verifyWorldSelfieProof } from "@/lib/world";
import { ensureHumanProfileOnChain } from "@/lib/facilityContract";

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
      proofPayload.responses?.[0]?.nullifier ||
      proofPayload.nullifier ||
      proofPayload.nullifier_hash ||
      `nullifier_${Date.now()}`;

    console.log("[World-Verify] Authenticated unique World ID nullifier:", nullifierHash);

    // Ensure on-chain $10 credit profile exists on Arc Testnet for this human nullifier
    try {
      await ensureHumanProfileOnChain(nullifierHash);
    } catch (profileErr: any) {
      console.warn("[World-Verify] Notice provisioning on-chain profile:", profileErr.message || profileErr);
    }

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
