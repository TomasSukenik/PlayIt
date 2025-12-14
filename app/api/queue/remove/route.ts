import { NextRequest, NextResponse } from "next/server";
import { getQueue, removeTracks } from "@/lib/votingQueue";

// POST /api/queue/remove - Remove multiple tracks from the queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackIds } = body;

    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
      return NextResponse.json(
        { error: "trackIds array is required" },
        { status: 400 }
      );
    }

    const removedCount = await removeTracks(trackIds);
    const queue = await getQueue();

    return NextResponse.json({
      success: true,
      removed: removedCount,
      queue,
    });
  } catch (error) {
    console.error("Error removing tracks:", error);
    return NextResponse.json(
      { error: "Failed to remove tracks" },
      { status: 500 }
    );
  }
}
