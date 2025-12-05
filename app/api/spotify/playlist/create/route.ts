import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/spotify";

interface CreatePlaylistRequest {
  name: string;
  description?: string;
  trackUris: string[]; // Array of Spotify track URIs like "spotify:track:xxxx"
  public?: boolean;
}

export async function POST(request: NextRequest) {
  // Get session from Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = authHeader.replace("Bearer ", "");
  const session = getSession(sessionId);

  if (!session?.accessToken || !session?.user?.id) {
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
    const body: CreatePlaylistRequest = await request.json();
    const { name, description, trackUris, public: isPublic = false } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Playlist name is required" },
        { status: 400 }
      );
    }

    if (!trackUris?.length) {
      return NextResponse.json(
        { error: "At least one track is required" },
        { status: 400 }
      );
    }

    // Step 1: Create the playlist
    const createPlaylistResponse = await fetch(
      `https://api.spotify.com/v1/users/${session.user.id}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description || "Created with PlayIt",
          public: isPublic,
        }),
      }
    );

    if (!createPlaylistResponse.ok) {
      const errorData = await createPlaylistResponse.json().catch(() => ({}));
      console.error("Failed to create playlist:", errorData);
      return NextResponse.json(
        { error: "Failed to create playlist on Spotify" },
        { status: createPlaylistResponse.status }
      );
    }

    const playlist = await createPlaylistResponse.json();

    // Step 2: Add tracks to the playlist (Spotify allows max 100 tracks per request)
    const trackChunks = [];
    for (let i = 0; i < trackUris.length; i += 100) {
      trackChunks.push(trackUris.slice(i, i + 100));
    }

    for (const chunk of trackChunks) {
      const addTracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: chunk,
          }),
        }
      );

      if (!addTracksResponse.ok) {
        const errorData = await addTracksResponse.json().catch(() => ({}));
        console.error("Failed to add tracks:", errorData);
        // Playlist was created but tracks failed - still return partial success
        return NextResponse.json(
          {
            playlist,
            warning: "Playlist created but some tracks could not be added",
          },
          { status: 207 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        external_urls: playlist.external_urls,
        tracks_added: trackUris.length,
      },
    });
  } catch (error) {
    console.error("Error creating playlist:", error);
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}

