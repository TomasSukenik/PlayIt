import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/spotify";

interface CreatePlaylistRequest {
  name: string;
  description?: string;
  trackUris: string[]; // Array of Spotify track URIs like "spotify:track:xxxx"
  public?: boolean;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  external_urls: { spotify: string };
  owner: { id: string };
}

// Find existing playlist by name owned by the user
async function findExistingPlaylist(
  accessToken: string,
  userId: string,
  playlistName: string
): Promise<SpotifyPlaylist | null> {
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const found = data.items?.find(
      (p: SpotifyPlaylist) =>
        p.name.toLowerCase() === playlistName.toLowerCase() &&
        p.owner.id === userId
    );

    if (found) {
      return found;
    }

    url = data.next;
  }

  return null;
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

    const trimmedName = name.trim();
    let playlist: SpotifyPlaylist;
    let isUpdate = false;

    // Step 1: Check if playlist already exists
    const existingPlaylist = await findExistingPlaylist(
      session.accessToken,
      session.user.id,
      trimmedName
    );

    if (existingPlaylist) {
      // Update existing playlist
      playlist = existingPlaylist;
      isUpdate = true;

      // Update playlist description
      await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: description || "Updated with PlayIt",
        }),
      });

      // Replace all tracks in the playlist (PUT replaces, POST adds)
      const replaceResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: trackUris.slice(0, 100), // First 100 tracks
          }),
        }
      );

      if (!replaceResponse.ok) {
        const errorData = await replaceResponse.json().catch(() => ({}));
        console.error("Failed to replace tracks:", errorData);
        return NextResponse.json(
          { error: "Failed to update playlist tracks" },
          { status: replaceResponse.status }
        );
      }

      // Add remaining tracks if more than 100
      if (trackUris.length > 100) {
        for (let i = 100; i < trackUris.length; i += 100) {
          const chunk = trackUris.slice(i, i + 100);
          await fetch(
            `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ uris: chunk }),
            }
          );
        }
      }
    } else {
      // Create new playlist
      const createPlaylistResponse = await fetch(
        `https://api.spotify.com/v1/users/${session.user.id}/playlists`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
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

      playlist = await createPlaylistResponse.json();

      // Add tracks to the new playlist (Spotify allows max 100 tracks per request)
      for (let i = 0; i < trackUris.length; i += 100) {
        const chunk = trackUris.slice(i, i + 100);
        const addTracksResponse = await fetch(
          `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: chunk }),
          }
        );

        if (!addTracksResponse.ok) {
          const errorData = await addTracksResponse.json().catch(() => ({}));
          console.error("Failed to add tracks:", errorData);
          return NextResponse.json(
            {
              playlist,
              warning: "Playlist created but some tracks could not be added",
            },
            { status: 207 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: isUpdate,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        external_urls: playlist.external_urls,
        tracks_added: trackUris.length,
      },
    });
  } catch (error) {
    console.error("Error creating/updating playlist:", error);
    return NextResponse.json(
      { error: "Failed to create/update playlist" },
      { status: 500 }
    );
  }
}

