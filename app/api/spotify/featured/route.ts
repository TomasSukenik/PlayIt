import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/spotify";

export async function GET() {
  try {
    const token = await getSpotifyToken();
    const response = await fetch(
      "https://api.spotify.com/v1/browse/featured-playlists?limit=20",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch featured playlists");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching featured playlists:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured playlists" },
      { status: 500 }
    );
  }
}

