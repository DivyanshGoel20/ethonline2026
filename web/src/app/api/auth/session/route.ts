import { NextRequest, NextResponse } from "next/server";
import { clearSession, getHuman, unauthenticated } from "@/lib/session";

/**
 * Who is driving this browser, and how to stop being them.
 *
 * The session cookie is httpOnly by design, so the page cannot read the
 * nullifier it was issued. Without somewhere to ask, the dashboard has to keep
 * its own copy of the human's identity in localStorage — which is exactly the
 * client-trusted identity the session layer replaced. This is the one endpoint
 * that hands it back, and it hands back only what the signed cookie already
 * proves.
 */
export async function GET(req: NextRequest) {
  const human = getHuman(req);
  if (!human) return unauthenticated();

  return NextResponse.json({ human });
}

/**
 * Sign out.
 *
 * Dropping the client's copy of the nullifier is not signing out: the cookie is
 * what authorises spending, and it stays valid for its full term until the
 * server is told to void it.
 */
export async function DELETE() {
  return clearSession(NextResponse.json({ signedOut: true }));
}
