import { NextRequest, NextResponse } from "next/server";
import { removeTrack, getQueue } from "@/lib/votingQueue";

// DELETE /api/queue/[spotifyId] - Remove a track from the queue
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ spotifyId: string }> }
) {
  const { spotifyId } = await params;

  if (!spotifyId) {
    return NextResponse.json(
      { error: "spotifyId is required" },
      { status: 400 }
    );
  }

  const removed = await removeTrack(spotifyId);
  if (!removed) {
    return NextResponse.json(
      { error: "Track not found in queue" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    queue: await getQueue(),
  });
}
