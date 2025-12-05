import { NextRequest, NextResponse } from "next/server";
import { getSession, setSession, deleteSession } from "@/lib/spotify";

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

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

  // Check if token needs refresh
  if (session.expiresAt && Date.now() > session.expiresAt - 60000) {
    try {
      const refreshResponse = await fetch(
        "https://accounts.spotify.com/api/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: session.refreshToken!,
          }),
        }
      );

      if (!refreshResponse.ok) {
        await deleteSession(sessionId);
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
      }

      const refreshData = await refreshResponse.json();
      session.accessToken = refreshData.access_token;
      session.expiresAt = Date.now() + refreshData.expires_in * 1000;
      if (refreshData.refresh_token) {
        session.refreshToken = refreshData.refresh_token;
      }
      await setSession(sessionId, session);
    } catch (error) {
      console.error("Error refreshing token:", error);
      await deleteSession(sessionId);
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
  }

  return NextResponse.json({ user: session.user });
}

