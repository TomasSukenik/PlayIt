import { NextRequest, NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const type = searchParams.get("type") || "playlist";
  const limit = searchParams.get("limit") || "20";

  if (!q) {
    return NextResponse.json(
      { error: "Search query (q) is required" },
      { status: 400 }
    );
  }

  try {
    const token = await getSpotifyToken();
    const searchUrl = new URL("https://api.spotify.com/v1/search");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("type", type);
    searchUrl.searchParams.set("limit", limit);

    const response = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Search failed");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}

