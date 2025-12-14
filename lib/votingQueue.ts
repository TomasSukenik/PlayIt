// Shared voting queue storage using Vercel KV (Redis)
import { kv } from "@vercel/kv";

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
  addedBy?: string;
}

interface VotingQueueState {
  tracks: QueuedTrack[];
  lastUpdated: number;
}

const QUEUE_KEY = "playit:queue";

// Get current state from KV
async function getState(): Promise<VotingQueueState> {
  const state = await kv.get<VotingQueueState>(QUEUE_KEY);
  return state ?? { tracks: [], lastUpdated: Date.now() };
}

// Save state to KV
async function setState(state: VotingQueueState): Promise<void> {
  await kv.set(QUEUE_KEY, state);
}

// Get all tracks
export async function getQueue(): Promise<VotingQueueState> {
  const state = await getState();
  return {
    tracks: [...state.tracks].sort((a, b) => b.votes - a.votes),
    lastUpdated: state.lastUpdated,
  };
}

// Get queue if updated since timestamp
export async function getQueueIfUpdated(
  since: number
): Promise<VotingQueueState | null> {
  const state = await getState();
  if (state.lastUpdated > since) {
    return {
      tracks: [...state.tracks].sort((a, b) => b.votes - a.votes),
      lastUpdated: state.lastUpdated,
    };
  }
  return null;
}

// Add a track to the queue
export async function addTrack(
  track: Omit<QueuedTrack, "votes" | "addedAt" | "id">
): Promise<QueuedTrack | null> {
  const state = await getState();

  // Check if track already exists
  const exists = state.tracks.some((t) => t.spotifyId === track.spotifyId);
  if (exists) {
    return null;
  }

  // Limit queue size to 30 tracks
  if (state.tracks.length >= 30) {
    return null;
  }

  const newTrack: QueuedTrack = {
    ...track,
    id: `${track.spotifyId}-${Date.now()}`,
    votes: 0,
    addedAt: Date.now(),
  };

  state.tracks.push(newTrack);
  state.lastUpdated = Date.now();
  await setState(state);

  return newTrack;
}

// Add multiple tracks at once (for bulk operations like adding from playlist)
export async function addTracks(
  tracks: Omit<QueuedTrack, "votes" | "addedAt" | "id">[],
  replaceAll = false
): Promise<QueuedTrack[]> {
  const state = await getState();

  if (replaceAll) {
    state.tracks = [];
  }

  const addedTracks: QueuedTrack[] = [];
  const existingIds = new Set(state.tracks.map((t) => t.spotifyId));

  for (const track of tracks) {
    if (state.tracks.length >= 30) break;
    if (existingIds.has(track.spotifyId)) continue;

    const newTrack: QueuedTrack = {
      ...track,
      id: `${track.spotifyId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      votes: 0,
      addedAt: Date.now(),
    };

    state.tracks.push(newTrack);
    existingIds.add(track.spotifyId);
    addedTracks.push(newTrack);
  }

  state.lastUpdated = Date.now();
  await setState(state);
  return addedTracks;
}

// Remove a track from the queue
export async function removeTrack(spotifyId: string): Promise<boolean> {
  const state = await getState();
  const initialLength = state.tracks.length;
  state.tracks = state.tracks.filter((t) => t.spotifyId !== spotifyId);

  if (state.tracks.length !== initialLength) {
    state.lastUpdated = Date.now();
    await setState(state);
    return true;
  }
  return false;
}

// Remove multiple tracks by their IDs
export async function removeTracks(trackIds: string[]): Promise<number> {
  const state = await getState();
  const initialLength = state.tracks.length;
  const idsToRemove = new Set(trackIds);
  state.tracks = state.tracks.filter((t) => !idsToRemove.has(t.id));

  const removedCount = initialLength - state.tracks.length;
  if (removedCount > 0) {
    state.lastUpdated = Date.now();
    await setState(state);
  }
  return removedCount;
}

// Upvote a track
export async function upvoteTrack(
  spotifyId: string
): Promise<QueuedTrack | null> {
  const state = await getState();
  const track = state.tracks.find((t) => t.spotifyId === spotifyId);
  if (track) {
    track.votes += 1;
    state.lastUpdated = Date.now();
    await setState(state);
    return track;
  }
  return null;
}

// Clear the entire queue
export async function clearQueue(): Promise<void> {
  await setState({ tracks: [], lastUpdated: Date.now() });
}

// Get track URIs sorted by votes (for creating playlists)
export async function getTrackUrisSortedByVotes(): Promise<string[]> {
  const state = await getState();
  return [...state.tracks]
    .sort((a, b) => b.votes - a.votes)
    .map((t) => `spotify:track:${t.spotifyId}`);
}
