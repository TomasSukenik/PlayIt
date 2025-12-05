import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const sessionId = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");

  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ accessToken: session.accessToken });
}

