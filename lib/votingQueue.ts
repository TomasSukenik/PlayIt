// Shared voting queue storage
// In production, this would be Redis, a database, etc.
// For now, we use in-memory storage that persists during server runtime

export interface QueuedTrack {
  id: string;
  spotifyId: string;
  name: string;
  artists: string;
  albumName: string;
  albumArt?: string;
  duration_ms: number;
  votes: number;
  addedAt: number;
  addedBy?: string; // Optional user identifier
}

interface VotingQueueState {
  tracks: QueuedTrack[];
  lastUpdated: number;
}

// In-memory store
let votingQueue: VotingQueueState = {
  tracks: [],
  lastUpdated: Date.now(),
};

// Get all tracks
export function getQueue(): VotingQueueState {
  return {
    tracks: [...votingQueue.tracks].sort((a, b) => b.votes - a.votes),
    lastUpdated: votingQueue.lastUpdated,
  };
}

// Get queue if updated since timestamp
export function getQueueIfUpdated(since: number): VotingQueueState | null {
  if (votingQueue.lastUpdated > since) {
    return getQueue();
  }
  return null;
}

// Add a track to the queue
export function addTrack(track: Omit<QueuedTrack, "votes" | "addedAt" | "id">): QueuedTrack | null {
  // Check if track already exists
  const exists = votingQueue.tracks.some((t) => t.spotifyId === track.spotifyId);
  if (exists) {
    return null;
  }

  // Limit queue size to 30 tracks
  if (votingQueue.tracks.length >= 30) {
    return null;
  }

  const newTrack: QueuedTrack = {
    ...track,
    id: `${track.spotifyId}-${Date.now()}`,
    votes: 0,
    addedAt: Date.now(),
  };

  votingQueue.tracks.push(newTrack);
  votingQueue.lastUpdated = Date.now();

  return newTrack;
}

// Add multiple tracks at once (for bulk operations like adding from playlist)
export function addTracks(
  tracks: Omit<QueuedTrack, "votes" | "addedAt" | "id">[],
  replaceAll = false
): QueuedTrack[] {
  if (replaceAll) {
    // Clear existing queue and add new tracks
    votingQueue.tracks = [];
  }

  const addedTracks: QueuedTrack[] = [];
  const existingIds = new Set(votingQueue.tracks.map((t) => t.spotifyId));

  for (const track of tracks) {
    if (votingQueue.tracks.length >= 30) break;
    if (existingIds.has(track.spotifyId)) continue;

    const newTrack: QueuedTrack = {
      ...track,
      id: `${track.spotifyId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      votes: 0,
      addedAt: Date.now(),
    };

    votingQueue.tracks.push(newTrack);
    existingIds.add(track.spotifyId);
    addedTracks.push(newTrack);
  }

  votingQueue.lastUpdated = Date.now();
  return addedTracks;
}

// Remove a track from the queue
export function removeTrack(spotifyId: string): boolean {
  const initialLength = votingQueue.tracks.length;
  votingQueue.tracks = votingQueue.tracks.filter((t) => t.spotifyId !== spotifyId);

  if (votingQueue.tracks.length !== initialLength) {
    votingQueue.lastUpdated = Date.now();
    return true;
  }
  return false;
}

// Upvote a track
export function upvoteTrack(spotifyId: string): QueuedTrack | null {
  const track = votingQueue.tracks.find((t) => t.spotifyId === spotifyId);
  if (track) {
    track.votes += 1;
    votingQueue.lastUpdated = Date.now();
    return track;
  }
  return null;
}

// Clear the entire queue
export function clearQueue(): void {
  votingQueue.tracks = [];
  votingQueue.lastUpdated = Date.now();
}

// Get track URIs sorted by votes (for creating playlists)
export function getTrackUrisSortedByVotes(): string[] {
  return [...votingQueue.tracks]
    .sort((a, b) => b.votes - a.votes)
    .map((t) => `spotify:track:${t.spotifyId}`);
}

