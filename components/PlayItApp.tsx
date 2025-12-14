"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Spotify API response types
interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  images?: SpotifyImage[];
  external_urls: { spotify: string };
}

interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  artists: SpotifyArtist[];
  release_date: string;
  total_tracks: number;
  external_urls: { spotify: string };
}

interface SpotifyTrackSimple {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  external_urls: { spotify: string };
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  owner: { display_name: string };
  tracks: { total: number };
  external_urls: { spotify: string };
}

interface SpotifyPlaylistFull extends SpotifyPlaylist {
  tracks: {
    total: number;
    items: { track: SpotifyTrackSimple }[];
  };
}

interface SpotifyAlbumFull extends SpotifyAlbum {
  tracks: {
    items: {
      id: string;
      name: string;
      artists: SpotifyArtist[];
      duration_ms: number;
    }[];
  };
}

interface SearchResults {
  tracks?: { items: SpotifyTrackSimple[] };
  albums?: { items: SpotifyAlbum[] };
  playlists?: { items: SpotifyPlaylist[] };
  artists?: { items: SpotifyArtist[] };
}

// Server-side queued track
interface QueuedTrack {
  id: string;
  spotifyId: string;
  name: string;
  artists: string;
  albumName: string;
  albumArt?: string;
  duration_ms: number;
  votes: number;
  addedAt: number;
}

interface VoteableSong {
  spotifyId: string;
  title: string;
  artist: string;
  albumArt?: string;
  votes: number;
}

// Polling interval for queue updates (2 seconds)
const POLL_INTERVAL = 2000;

// Helper to format duration
const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Search result item components
function TrackResultItem({
  track,
  onSelect,
  isAdded,
}: {
  track: SpotifyTrackSimple;
  onSelect: (track: SpotifyTrackSimple) => void;
  isAdded: boolean;
}) {
  return (
    <li
      className={`search-result-item ${isAdded ? "added" : ""}`}
      onClick={() => !isAdded && onSelect(track)}
    >
      {track.album.images?.[2] && (
        <img src={track.album.images[2].url} alt="" className="result-art" />
      )}
      <div className="result-info">
        <span className="result-title">{track.name}</span>
        <span className="result-subtitle">
          {track.artists.map((a) => a.name).join(", ")}
        </span>
      </div>
      <span className="result-meta">{formatDuration(track.duration_ms)}</span>
      <button
        className={`add-btn ${isAdded ? "added" : ""}`}
        title={isAdded ? "Added" : "Add to voting"}
        disabled={isAdded}
      >
        {isAdded ? "✓" : "+"}
      </button>
    </li>
  );
}

function AlbumResultItem({
  album,
  onSelect,
}: {
  album: SpotifyAlbum;
  onSelect: (album: SpotifyAlbum) => void;
}) {
  return (
    <li className="search-result-item" onClick={() => onSelect(album)}>
      {album.images?.[2] && (
        <img src={album.images[2].url} alt="" className="result-art" />
      )}
      <div className="result-info">
        <span className="result-title">{album.name}</span>
        <span className="result-subtitle">
          {album.artists.map((a) => a.name).join(", ")}
        </span>
      </div>
      <span className="result-meta">{album.total_tracks} tracks</span>
      <span className="result-type-badge">Album</span>
    </li>
  );
}

function PlaylistResultItem({
  playlist,
  onSelect,
}: {
  playlist: SpotifyPlaylist;
  onSelect: (playlist: SpotifyPlaylist) => void;
}) {
  return (
    <li className="search-result-item" onClick={() => onSelect(playlist)}>
      {playlist.images?.[0] && (
        <img src={playlist.images[0].url} alt="" className="result-art" />
      )}
      <div className="result-info">
        <span className="result-title">{playlist.name}</span>
        <span className="result-subtitle">
          by {playlist.owner.display_name}
        </span>
      </div>
      <span className="result-meta">{playlist.tracks.total} tracks</span>
      <span className="result-type-badge">Playlist</span>
    </li>
  );
}

function ArtistResultItem({
  artist,
  onSelect,
}: {
  artist: SpotifyArtist;
  onSelect: (artist: SpotifyArtist) => void;
}) {
  return (
    <li className="search-result-item" onClick={() => onSelect(artist)}>
      {artist.images?.[2] ? (
        <img
          src={artist.images[2].url}
          alt=""
          className="result-art artist-art"
        />
      ) : (
        <div className="result-art artist-art placeholder">🎤</div>
      )}
      <div className="result-info">
        <span className="result-title">{artist.name}</span>
        <span className="result-subtitle">Artist</span>
      </div>
      <span className="result-type-badge">Artist</span>
    </li>
  );
}

function VoteableSongItem({
  song,
  rank,
  onUpvote,
  onRemove,
}: {
  song: VoteableSong;
  rank: number;
  onUpvote: (spotifyId: string) => void;
  onRemove: (spotifyId: string) => void;
}) {
  return (
    <li className="song-item">
      <span className="rank">{rank}</span>
      {song.albumArt && (
        <img src={song.albumArt} alt="" className="track-art" />
      )}
      <div className="song-info">
        <span className="title">{song.title}</span>
        <span className="artist">{song.artist}</span>
      </div>
      <div className="song-actions">
        <button
          className="upvote-btn"
          onClick={() => onUpvote(song.spotifyId)}
          title="Upvote"
        >
          <span className="arrow">▲</span>
          <span className="vote-count">{song.votes}</span>
        </button>
        <button
          style={{ display: "none" }}
          className="remove-btn"
          onClick={() => onRemove(song.spotifyId)}
          title="Remove"
        >
          ×
        </button>
      </div>
    </li>
  );
}

export default function PlayItApp() {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search query (300ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Selected content state
  const [selectedPlaylist, setSelectedPlaylist] =
    useState<SpotifyPlaylistFull | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbumFull | null>(
    null
  );
  const [loadingContent, setLoadingContent] = useState(false);

  // Voting queue state (synced with server)
  const [queuedTracks, setQueuedTracks] = useState<QueuedTrack[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [queueLoading, setQueueLoading] = useState(true);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hasAutoOpenedDrawer = useRef(false);

  // Auto-open drawer on initial load if there are songs in the queue
  useEffect(() => {
    // Only auto-open once, after initial queue load completes
    if (
      !queueLoading &&
      !hasAutoOpenedDrawer.current &&
      queuedTracks.length > 0
    ) {
      hasAutoOpenedDrawer.current = true;
      // Small delay to let the page render first, so user sees the animation
      const timer = setTimeout(() => {
        setIsDrawerOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [queueLoading, queuedTracks.length]);

  // Fetch queue from server
  const fetchQueue = useCallback(async (since?: number) => {
    try {
      const url = since ? `/api/queue?since=${since}` : "/api/queue";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch queue");
      const data = await res.json();

      // If using "since" parameter and no update, skip
      if (since && data.updated === false) {
        return false;
      }

      setQueuedTracks(data.tracks || []);
      setLastUpdated(data.lastUpdated || Date.now());
      return true;
    } catch (error) {
      console.error("Error fetching queue:", error);
      return false;
    }
  }, []);

  // Initial queue fetch
  useEffect(() => {
    const initQueue = async () => {
      setQueueLoading(true);
      await fetchQueue();
      setQueueLoading(false);
    };
    initQueue();
  }, [fetchQueue]);

  // Poll for queue updates
  useEffect(() => {
    const poll = async () => {
      if (lastUpdated > 0) {
        await fetchQueue(lastUpdated);
      }
      pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL);
    };

    // Start polling after initial load
    if (!queueLoading && lastUpdated > 0) {
      pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL);
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [queueLoading, lastUpdated, fetchQueue]);

  // Track IDs that are in the voting list (from server queue)
  const votingTrackIds = new Set(queuedTracks.map((t) => t.spotifyId));

  // Convert queued tracks to voteable songs (already sorted by votes from server)
  const voteableSongs: VoteableSong[] = queuedTracks.map((track) => ({
    spotifyId: track.spotifyId,
    title: track.name,
    artist: track.artists,
    albumArt: track.albumArt,
    votes: track.votes,
  }));

  // Upvote a track (calls server API)
  const handleSpotifyUpvote = async (spotifyId: string) => {
    try {
      const res = await fetch("/api/queue/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyId }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueuedTracks(data.queue.tracks);
        setLastUpdated(data.queue.lastUpdated);
      }
    } catch (error) {
      console.error("Error upvoting:", error);
    }
  };

  // Remove a track from the queue (calls server API)
  const handleRemoveTrack = async (spotifyId: string) => {
    try {
      const res = await fetch(`/api/queue/${spotifyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setQueuedTracks(data.queue.tracks);
        setLastUpdated(data.queue.lastUpdated);
      }
    } catch (error) {
      console.error("Error removing track:", error);
    }
  };

  // Search Spotify (can be called directly or via form submit)
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 3) return;

    setSearching(true);
    setSearchError(null);
    setSelectedPlaylist(null);
    setSelectedAlbum(null);

    try {
      const res = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("Failed to search. Please try again.");
    } finally {
      setSearching(false);
    }
  }, []);

  // Auto-search when debounced query changes (3+ characters)
  useEffect(() => {
    if (debouncedSearchQuery.trim().length >= 3) {
      performSearch(debouncedSearchQuery);
    } else if (debouncedSearchQuery.trim().length === 0) {
      // Clear results when query is empty
      setSearchResults(null);
    }
  }, [debouncedSearchQuery, performSearch]);

  // Manual search (form submit) - immediate, no debounce
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 3) {
      performSearch(searchQuery);
    }
  };

  // Load full playlist
  const loadPlaylist = async (playlist: SpotifyPlaylist) => {
    setLoadingContent(true);
    try {
      const res = await fetch(`/api/spotify/playlist/${playlist.id}`);
      if (!res.ok) throw new Error("Failed to load playlist");
      const data = await res.json();
      setSelectedPlaylist(data);
      setSelectedAlbum(null);
      setSearchResults(null);
    } catch (error) {
      console.error("Load playlist error:", error);
      setSearchError("Failed to load playlist");
    } finally {
      setLoadingContent(false);
    }
  };

  // Load full album
  const loadAlbum = async (album: SpotifyAlbum) => {
    setLoadingContent(true);
    try {
      const res = await fetch(`/api/spotify/album/${album.id}`);
      if (!res.ok) throw new Error("Failed to load album");
      const data = await res.json();
      setSelectedAlbum({ ...album, ...data });
      setSelectedPlaylist(null);
      setSearchResults(null);
    } catch (error) {
      console.error("Load album error:", error);
      setSearchError("Failed to load album");
    } finally {
      setLoadingContent(false);
    }
  };

  // Add single track to voting (calls server API)
  const addTrackToVoting = async (track: SpotifyTrackSimple) => {
    if (queuedTracks.some((t) => t.spotifyId === track.id)) return;
    if (queuedTracks.length >= 30) return; // Max 30 tracks

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyId: track.id,
          name: track.name,
          artists: track.artists.map((a) => a.name).join(", "),
          albumName: track.album?.name || "",
          albumArt: track.album?.images?.[2]?.url,
          duration_ms: track.duration_ms,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueuedTracks(data.queue.tracks);
        setLastUpdated(data.queue.lastUpdated);
      }
    } catch (error) {
      console.error("Error adding track:", error);
    }
  };

  // Load all tracks from playlist to voting (calls server API)
  // Keeps existing tracks in queue, only adds new ones that aren't duplicates
  const loadPlaylistToVoting = async (playlist: SpotifyPlaylistFull) => {
    const tracks = playlist.tracks.items
      .filter((item) => item.track)
      .map((item) => ({
        spotifyId: item.track.id,
        name: item.track.name,
        artists: item.track.artists.map((a) => a.name).join(", "),
        albumName: item.track.album?.name || "",
        albumArt: item.track.album?.images?.[2]?.url,
        duration_ms: item.track.duration_ms,
      }))
      .slice(0, 30);

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks, replaceAll: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueuedTracks(data.queue.tracks);
        setLastUpdated(data.queue.lastUpdated);
      }
    } catch (error) {
      console.error("Error loading playlist to voting:", error);
    }
  };

  // Load all tracks from album to voting (calls server API)
  // Keeps existing tracks in queue, only adds new ones that aren't duplicates
  const loadAlbumToVoting = async (album: SpotifyAlbumFull) => {
    const tracks = album.tracks.items
      .map((t) => ({
        spotifyId: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name).join(", "),
        albumName: album.name,
        albumArt: album.images?.[2]?.url,
        duration_ms: t.duration_ms,
      }))
      .slice(0, 30);

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks, replaceAll: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueuedTracks(data.queue.tracks);
        setLastUpdated(data.queue.lastUpdated);
      }
    } catch (error) {
      console.error("Error loading album to voting:", error);
    }
  };

  // Clear selection and go back to search
  const clearSelection = () => {
    setSelectedPlaylist(null);
    setSelectedAlbum(null);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">
            <img
              src="/zahraj_cosi_logo.svg"
              alt="ZAHRAJ ČOSI"
              className="logo-image"
            />
          </h1>
          <p className="tagline">Search music & vote for what plays next</p>
        </div>
      </header>

      <main className="main-layout">
        {/* Search Panel */}
        <section className="search-panel">
          <div className="search-container">
            <form onSubmit={handleSearch} className="search-form">
              <input
                ref={searchInputRef}
                id="search"
                name="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type 3+ characters to search..."
                className="search-input"
              />
              <button
                type="submit"
                className="search-btn"
                disabled={searching || searchQuery.trim().length < 3}
              >
                {searching ? "..." : "Search"}
              </button>
            </form>
          </div>

          {searchError && (
            <div className="search-error">
              <p>❌ {searchError}</p>
            </div>
          )}

          {(searching || loadingContent) && (
            <div className="loading-state">Loading...</div>
          )}

          {/* Search Results */}
          {searchResults &&
            !selectedPlaylist &&
            !selectedAlbum &&
            !searching && (
              <div className="search-results">
                <ul className="results-list">
                  {/* Tracks */}
                  {searchResults.tracks?.items
                    .filter((track) => track !== null)
                    .map((track) => (
                      <TrackResultItem
                        key={`track-${track.id}`}
                        track={track}
                        onSelect={addTrackToVoting}
                        isAdded={votingTrackIds.has(track.id)}
                      />
                    ))}

                  {/* Albums */}
                  {searchResults.albums?.items
                    .filter((album) => album !== null)
                    .map((album) => (
                      <AlbumResultItem
                        key={`album-${album.id}`}
                        album={album}
                        onSelect={loadAlbum}
                      />
                    ))}

                  {/* Playlists */}
                  {searchResults.playlists?.items
                    .filter((playlist) => playlist !== null)
                    .map((playlist) => (
                      <PlaylistResultItem
                        key={`playlist-${playlist.id}`}
                        playlist={playlist}
                        onSelect={loadPlaylist}
                      />
                    ))}

                  {/* Artists */}
                  {searchResults.artists?.items
                    .filter((artist) => artist !== null)
                    .map((artist) => (
                      <ArtistResultItem
                        key={`artist-${artist.id}`}
                        artist={artist}
                        onSelect={() => {
                          setSearchQuery(artist.name);
                        }}
                      />
                    ))}
                </ul>
              </div>
            )}

          {/* Selected Playlist View */}
          {selectedPlaylist && !loadingContent && (
            <div className="selected-content">
              <button className="back-btn" onClick={clearSelection}>
                ← Back to results
              </button>
              <div className="content-header">
                {selectedPlaylist.images?.[0] && (
                  <img
                    src={selectedPlaylist.images[0].url}
                    alt=""
                    className="content-cover"
                  />
                )}
                <div className="content-info">
                  <span className="content-type">Playlist</span>
                  <h3>{selectedPlaylist.name}</h3>
                  <span className="content-meta">
                    by {selectedPlaylist.owner.display_name} •{" "}
                    {selectedPlaylist.tracks.total} tracks
                  </span>
                  <button
                    className="use-for-voting-btn"
                    onClick={() => loadPlaylistToVoting(selectedPlaylist)}
                  >
                    Add All to Voting
                  </button>
                </div>
              </div>
              <ul className="track-list">
                {selectedPlaylist.tracks.items.slice(0, 50).map(
                  (item, index) =>
                    item.track && (
                      <li
                        key={item.track.id}
                        className={`track-item ${
                          votingTrackIds.has(item.track.id) ? "added" : ""
                        }`}
                        onClick={() => addTrackToVoting(item.track)}
                      >
                        <span className="track-num">{index + 1}</span>
                        {item.track.album.images?.[2] && (
                          <img
                            src={item.track.album.images[2].url}
                            alt=""
                            className="track-art-small"
                          />
                        )}
                        <div className="track-info">
                          <span className="track-name">{item.track.name}</span>
                          <span className="track-artist">
                            {item.track.artists.map((a) => a.name).join(", ")}
                          </span>
                        </div>
                        <span className="track-duration">
                          {formatDuration(item.track.duration_ms)}
                        </span>
                        <button
                          className={`add-track-btn ${
                            votingTrackIds.has(item.track.id) ? "added" : ""
                          }`}
                          title={
                            votingTrackIds.has(item.track.id)
                              ? "Added"
                              : "Add to voting"
                          }
                        >
                          {votingTrackIds.has(item.track.id) ? "✓" : "+"}
                        </button>
                      </li>
                    )
                )}
              </ul>
            </div>
          )}

          {/* Selected Album View */}
          {selectedAlbum && !loadingContent && (
            <div className="selected-content">
              <button className="back-btn" onClick={clearSelection}>
                ← Back to results
              </button>
              <div className="content-header">
                {selectedAlbum.images?.[0] && (
                  <img
                    src={selectedAlbum.images[0].url}
                    alt=""
                    className="content-cover"
                  />
                )}
                <div className="content-info">
                  <span className="content-type">Album</span>
                  <h3>{selectedAlbum.name}</h3>
                  <span className="content-meta">
                    {selectedAlbum.artists.map((a) => a.name).join(", ")} •{" "}
                    {selectedAlbum.release_date?.split("-")[0]} •{" "}
                    {selectedAlbum.total_tracks} tracks
                  </span>
                  <button
                    className="use-for-voting-btn"
                    onClick={() => loadAlbumToVoting(selectedAlbum)}
                  >
                    Add All to Voting
                  </button>
                </div>
              </div>
              <ul className="track-list">
                {selectedAlbum.tracks.items.map((track, index) => {
                  const trackWithAlbum = {
                    ...track,
                    album: selectedAlbum,
                    external_urls: { spotify: "" },
                  };
                  return (
                    <li
                      key={track.id}
                      className={`track-item ${
                        votingTrackIds.has(track.id) ? "added" : ""
                      }`}
                      onClick={() => addTrackToVoting(trackWithAlbum)}
                    >
                      <span className="track-num">{index + 1}</span>
                      <div className="track-info">
                        <span className="track-name">{track.name}</span>
                        <span className="track-artist">
                          {track.artists.map((a) => a.name).join(", ")}
                        </span>
                      </div>
                      <span className="track-duration">
                        {formatDuration(track.duration_ms)}
                      </span>
                      <button
                        className={`add-track-btn ${
                          votingTrackIds.has(track.id) ? "added" : ""
                        }`}
                        title={
                          votingTrackIds.has(track.id)
                            ? "Added"
                            : "Add to voting"
                        }
                      >
                        {votingTrackIds.has(track.id) ? "✓" : "+"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Voting Panel */}
        <section
          className={`voting-panel ${isDrawerOpen ? "drawer-open" : ""}`}
        >
          {/* Mobile drawer handle */}
          <div
            className="drawer-handle"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          >
            <div className="drawer-handle-bar"></div>
            <div className="drawer-peek">
              <span className="drawer-peek-title">Voting Queue</span>
              <span className="drawer-peek-count">
                {voteableSongs.length}{" "}
                {voteableSongs.length === 1 ? "song" : "songs"}
              </span>
            </div>
          </div>

          <div className="voting-content">
            <div className="voting-header">
              <div className="voting-title">
                <h2>Voting Queue</h2>
                <span
                  className="live-indicator"
                  title="Shared across all devices"
                >
                  <span className="live-dot"></span>
                  LIVE
                </span>
              </div>
            </div>

            {queueLoading ? (
              <div className="empty-voting">
                <p>Loading queue...</p>
              </div>
            ) : voteableSongs.length > 0 ? (
              <>
                <p className="song-count">
                  {voteableSongs.length} songs • shared with all users
                </p>
                <ul className="song-list">
                  {voteableSongs.map((song, index) => (
                    <VoteableSongItem
                      key={song.spotifyId}
                      song={song}
                      rank={index + 1}
                      onUpvote={handleSpotifyUpvote}
                      onRemove={handleRemoveTrack}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <div className="empty-voting">
                <p>No songs yet</p>
                <span className="empty-hint">
                  Search for music and click + to add songs
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Backdrop for mobile drawer */}
        {isDrawerOpen && (
          <div
            className="drawer-backdrop"
            onClick={() => setIsDrawerOpen(false)}
          />
        )}
      </main>
    </div>
  );
}
