import { WorldVerificationPayload } from "../types";

/**
 * World Selfie Check Verification Helper
 * Verifies the biometric liveness / low-assurance credential proof with World Developer API.
 */
export async function verifyWorldSelfieProof(
  proofData: WorldVerificationPayload
): Promise<{ success: boolean; error?: string }> {
  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  const action = process.env.NEXT_PUBLIC_WORLD_ACTION || "float-human-verify";

  if (!appId) {
    return { success: false, error: "NEXT_PUBLIC_WORLD_APP_ID is not configured" };
  }

  try {
    const response = await fetch(
      `https://developer.worldcoin.org/api/v1/verify/${appId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...proofData,
          action,
        }),
      }
    );

    const result = await response.json();

    if (response.ok && result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result.detail || result.code || "World ID verification failed",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to reach World Developer API",
    };
  }
}
