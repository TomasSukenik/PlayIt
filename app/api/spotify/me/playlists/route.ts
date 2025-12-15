import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  // Get session from Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = authHeader.replace("Bearer ", "");
  const session = await getSession(sessionId);

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Invalid session or not logged in" },
      { status: 401 }
    );
  }

  // Check if token is expired and needs refresh
  if (session.expiresAt && Date.now() > session.expiresAt) {
    return NextResponse.json(
      { error: "Session expired, please login again" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "50";
    const offset = searchParams.get("offset") || "0";

    const response = await fetch(
      `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch playlists");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching user playlists:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlists" },
      { status: 500 }
    );
  }
}

