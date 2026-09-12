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

    // Fail closed. A timestamp fallback would mint a brand-new "human" on every
    // login, which silently voids the one-human-one-credit-limit guarantee that
    // the whole facility depends on.
    const nullifierHash: string | undefined =
      verification.nullifier ||
      proofPayload.responses?.[0]?.nullifier ||
      proofPayload.nullifier ||
      proofPayload.nullifier_hash;

    if (!nullifierHash) {
      console.error("[World-Verify] Proof verified but returned no nullifier - refusing to proceed");
      return NextResponse.json(
        {
          verified: false,
          error: "Verification succeeded but no nullifier was returned; cannot identify the human",
          code: "missing_nullifier",
        },
        { status: 400 }
      );
    }

    console.log("[World-Verify] Authenticated unique World ID nullifier:", nullifierHash);

    // Ensure on-chain $10 credit profile exists on Arc Testnet for this human nullifier
    // Report provisioning honestly rather than swallowing it. Verification can
    // legitimately succeed while the chain write fails, and the caller needs to
    // know it has no credit profile yet.
    let profileProvisioned = true;
    let profileError: string | undefined;
    try {
      await ensureHumanProfileOnChain(nullifierHash);
    } catch (profileErr: any) {
      profileProvisioned = false;
      profileError = profileErr?.message || String(profileErr);
      console.warn("[World-Verify] Could not provision on-chain profile:", profileError);
    }

    return NextResponse.json({
      verified: true,
      nullifierHash,
      verificationLevel: "selfie",
      profileProvisioned,
      ...(profileError ? { profileError } : {}),
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
