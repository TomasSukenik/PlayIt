import { NextRequest, NextResponse } from "next/server";
import {
  getQueue,
  getQueueIfUpdated,
  addTrack,
  addTracks,
  clearQueue,
} from "@/lib/votingQueue";

// GET /api/queue - Get the current voting queue
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const since = searchParams.get("since");

  // If "since" parameter is provided, only return if updated
  if (since) {
    const sinceTimestamp = parseInt(since, 10);
    if (!isNaN(sinceTimestamp)) {
      const queue = await getQueueIfUpdated(sinceTimestamp);
      if (queue === null) {
        return NextResponse.json({ updated: false });
      }
      return NextResponse.json({ updated: true, ...queue });
    }
  }

  const queue = await getQueue();
  return NextResponse.json(queue);
}

// POST /api/queue - Add track(s) to the queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle bulk add with replace
    if (body.tracks && Array.isArray(body.tracks)) {
      const added = await addTracks(body.tracks, body.replaceAll === true);
      return NextResponse.json({
        success: true,
        added: added.length,
        queue: await getQueue(),
      });
    }

    // Handle single track add
    if (body.spotifyId) {
      const track = await addTrack({
        spotifyId: body.spotifyId,
        name: body.name,
        artists: body.artists,
        albumName: body.albumName,
        albumArt: body.albumArt,
        duration_ms: body.duration_ms,
        addedBy: body.addedBy,
      });

      if (!track) {
        return NextResponse.json(
          { error: "Track already in queue or queue is full (max 10000)" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        track,
        queue: await getQueue(),
      });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error adding to queue:", error);
    return NextResponse.json(
      { error: "Failed to add to queue" },
      { status: 500 }
    );
  }
}

// DELETE /api/queue - Clear the entire queue
export async function DELETE() {
  await clearQueue();
  return NextResponse.json({ success: true, queue: await getQueue() });
}
