import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/spotify";

export async function POST(request: NextRequest) {
  const sessionId = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");

  if (sessionId) {
    await deleteSession(sessionId);
  }

  return NextResponse.json({ success: true });
}

