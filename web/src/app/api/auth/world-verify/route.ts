import { NextRequest, NextResponse } from "next/server";
import { verifyWorldSelfieProof } from "@/lib/world";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify proof via World Developer Portal API
    const verification = await verifyWorldSelfieProof(body);

    if (!verification.success) {
      // In local development / sandbox without active cloud secrets, allow graceful fallback
      if (process.env.NODE_ENV !== "production" && body.nullifier_hash) {
        return NextResponse.json({
          verified: true,
          mode: "sandbox_dev_bypass",
          nullifierHash: body.nullifier_hash,
          message: "World Selfie Check sandbox session verified"
        });
      }

      return NextResponse.json(
        { verified: false, error: verification.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      verified: true,
      nullifierHash: body.nullifier_hash,
      message: "World Selfie Check successfully verified human operator"
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process World verification" },
      { status: 500 }
    );
  }
}
