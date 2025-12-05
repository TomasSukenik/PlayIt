import { NextRequest, NextResponse } from "next/server";
import { upvoteTrack, getQueue } from "@/lib/votingQueue";

// POST /api/queue/vote - Upvote a track
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spotifyId } = body;

    if (!spotifyId) {
      return NextResponse.json(
        { error: "spotifyId is required" },
        { status: 400 }
      );
    }

    const track = await upvoteTrack(spotifyId);
    if (!track) {
      return NextResponse.json(
        { error: "Track not found in queue" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      track,
      queue: await getQueue(),
    });
  } catch (error) {
    console.error("Error upvoting track:", error);
    return NextResponse.json(
      { error: "Failed to upvote track" },
      { status: 500 }
    );
  }
}
