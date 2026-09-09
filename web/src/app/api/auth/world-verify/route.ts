import { NextRequest, NextResponse } from "next/server";
import { verifyWorldSelfieProof } from "@/lib/world";
import { ISuccessResult, VerificationLevel } from "@worldcoin/idkit-core";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Standardize proof payload from IDKit
    const proofData: ISuccessResult = body.proof && typeof body.proof === "object"
      ? body.proof
      : {
          merkle_root: body.merkle_root || "",
          nullifier_hash: body.nullifier_hash || "",
          proof: body.proof || "",
          verification_level: (body.verification_level as VerificationLevel) || VerificationLevel.Device,
        };

    const signal = body.signal;

    console.log("[World-Verify] Incoming verification request:", JSON.stringify(body));
    const verification = await verifyWorldSelfieProof(proofData, signal);
    console.log("[World-Verify] Verification API response:", verification);

    if (!verification.success) {
      console.error("[World-Verify] Verification failed:", verification.error, verification.code);
      return NextResponse.json(
        { verified: false, error: verification.error, code: verification.code },
        { status: 400 }
      );
    }

    return NextResponse.json({
      verified: true,
      nullifierHash: proofData.nullifier_hash,
      verificationLevel: proofData.verification_level,
      message: "Human operator authenticated via World Selfie Check",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process World ID verification" },
      { status: 500 }
    );
  }
}
