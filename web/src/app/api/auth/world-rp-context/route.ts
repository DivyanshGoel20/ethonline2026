import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit-core/signing";

export async function GET() {
  try {
    const action = process.env.NEXT_PUBLIC_WORLD_ACTION || "float-human-verify";
    const rpId = process.env.NEXT_PUBLIC_WORLD_RP_ID || "rp_c1e0eb1e9616e85c";
    const signingKeyHex = process.env.WORLD_API_KEY || "";

    if (!signingKeyHex) {
      return NextResponse.json(
        { error: "WORLD_API_KEY signing key is not configured" },
        { status: 500 }
      );
    }

    const sig = signRequest({
      action,
      signingKeyHex,
    });

    return NextResponse.json({
      rp_id: rpId,
      nonce: sig.nonce,
      created_at: sig.createdAt,
      expires_at: sig.expiresAt,
      signature: sig.sig,
    });
  } catch (error: any) {
    console.error("[World-RP-Context] Failed to generate RP signature:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate RP signature" },
      { status: 500 }
    );
  }
}
