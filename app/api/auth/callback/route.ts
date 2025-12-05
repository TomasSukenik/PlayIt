import { NextRequest, NextResponse } from "next/server";
import {
  generateRandomString,
  getSession,
  setSession,
  deleteSession,
} from "@/lib/spotify";

export async function POST(request: NextRequest) {
  const { code, state } = await request.json();

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/callback`;

  // Verify state
  if (!state || !getSession(state)) {
    return NextResponse.json(
      { error: "Invalid state parameter" },
      { status: 400 }
    );
  }
  deleteSession(state);

  if (!code) {
    return NextResponse.json(
      { error: "Authorization code is required" },
      { status: 400 }
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Token exchange failed");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get user profile
    const userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to get user profile");
    }

    const user = await userResponse.json();

    // Create session
    const sessionId = generateRandomString(32);
    setSession(sessionId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      user: {
        id: user.id,
        displayName: user.display_name,
        email: user.email,
        imageUrl: user.images?.[0]?.url,
        product: user.product,
      },
    });

    return NextResponse.json({
      sessionId,
      user: getSession(sessionId)?.user,
      expiresIn: expires_in,
    });
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    return NextResponse.json(
      { error: "Failed to authenticate with Spotify" },
      { status: 500 }
    );
  }
}

