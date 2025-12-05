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

// User type from Spotify
interface SpotifyUser {
  id: string;
  displayName: string;
  email: string;
  imageUrl?: string;
  product: string;
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
  // Auth state
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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

  // Sync state
  const [syncState, setSyncState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [createdPlaylist, setCreatedPlaylist] = useState<{
    name: string;
    url: string;
    tracks_added: number;
  } | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");

  const isLoggedIn = !!user;

  // Check for OAuth callback on page load
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      // Clear URL params
      if (code || error) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      if (error) {
        console.error("OAuth error:", error);
        setAuthLoading(false);
        return;
      }

      if (code && state) {
        try {
          const res = await fetch("/api/auth/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, state }),
          });

          if (res.ok) {
            const data = await res.json();
            localStorage.setItem("sessionId", data.sessionId);
            setUser(data.user);
          } else {
            console.error("Failed to exchange code");
          }
        } catch (err) {
          console.error("Callback error:", err);
        }
      }

      // Check existing session
      const sessionId = localStorage.getItem("sessionId");
      if (sessionId) {
        try {
          const res = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${sessionId}` },
          });

          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          } else {
            localStorage.removeItem("sessionId");
          }
        } catch (err) {
          console.error("Auth check error:", err);
        }
      }

      setAuthLoading(false);
    };

    handleCallback();
  }, []);

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

  // Handle Sync button click - opens modal
  const handleSync = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
    } else {
      // Generate default playlist name with date
      const date = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      setPlaylistName(`PlayIt Session - ${date}`);
      setSyncState("idle");
      setSyncError(null);
      setCreatedPlaylist(null);
      setShowSyncModal(true);
    }
  };

  // Actually create the playlist
  const createPlaylist = async () => {
    if (!playlistName.trim()) return;

    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      setSyncError("Session not found. Please log in again.");
      setSyncState("error");
      return;
    }

    setSyncState("loading");
    setSyncError(null);

    try {
      // Tracks are already sorted by votes from server
      const trackUris = queuedTracks.map((t) => `spotify:track:${t.spotifyId}`);

      const response = await fetch("/api/spotify/playlist/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          name: playlistName.trim(),
          description: `Created with PlayIt - ${queuedTracks.length} tracks sorted by votes`,
          trackUris,
          public: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create playlist");
      }

      const data = await response.json();
      setCreatedPlaylist({
        name: data.playlist.name,
        url: data.playlist.external_urls?.spotify || "",
        tracks_added: data.playlist.tracks_added,
      });
      setSyncState("success");
    } catch (error) {
      console.error("Sync error:", error);
      setSyncError(
        error instanceof Error ? error.message : "Failed to create playlist"
      );
      setSyncState("error");
    }
  };

  // Close sync modal and reset
  const closeSyncModal = () => {
    setShowSyncModal(false);
    setSyncState("idle");
    setSyncError(null);
  };

  // Handle Spotify login - redirect to Spotify OAuth
  const handleSpotifyLogin = async () => {
    try {
      const res = await fetch("/api/auth/login");
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    const sessionId = localStorage.getItem("sessionId");
    if (sessionId) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionId}` },
        });
      } catch (err) {
        console.error("Logout error:", err);
      }
    }
    localStorage.removeItem("sessionId");
    setUser(null);
  };

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
        body: JSON.stringify({ tracks, replaceAll: true }),
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
        body: JSON.stringify({ tracks, replaceAll: true }),
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

  // Clear the voting queue (calls server API)
  const clearVotingList = async () => {
    try {
      const res = await fetch("/api/queue", {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setQueuedTracks(data.queue.tracks);
        setLastUpdated(data.queue.lastUpdated);
      }
    } catch (error) {
      console.error("Error clearing queue:", error);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">PlayIt</h1>
          <p className="tagline">Search music & vote for what plays next</p>
        </div>
        <div className="header-right">
          {authLoading ? null : user ? (
            <div className="user-info">
              {user.imageUrl && (
                <img src={user.imageUrl} alt="" className="user-avatar" />
              )}
              <span className="user-name">{user.displayName}</span>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <button
              className="header-login-btn"
              onClick={() => setShowLoginModal(true)}
            >
              Login with Spotify
            </button>
          )}
        </div>
      </header>

      <main className="main-layout">
        {/* Search Panel */}
        <section className="search-panel">
          <div className="search-container">
            <form onSubmit={handleSearch} className="search-form">
              <input
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
                  {searchResults.tracks?.items.map((track) => (
                    <TrackResultItem
                      key={`track-${track.id}`}
                      track={track}
                      onSelect={addTrackToVoting}
                      isAdded={votingTrackIds.has(track.id)}
                    />
                  ))}

                  {/* Albums */}
                  {searchResults.albums?.items.map((album) => (
                    <AlbumResultItem
                      key={`album-${album.id}`}
                      album={album}
                      onSelect={loadAlbum}
                    />
                  ))}

                  {/* Playlists */}
                  {searchResults.playlists?.items.map((playlist) => (
                    <PlaylistResultItem
                      key={`playlist-${playlist.id}`}
                      playlist={playlist}
                      onSelect={loadPlaylist}
                    />
                  ))}

                  {/* Artists */}
                  {searchResults.artists?.items.map((artist) => (
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
        <section className="voting-panel">
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
            <div className="voting-actions">
              {voteableSongs.length > 0 && (
                <>
                  <button className="sync-btn" onClick={handleSync}>
                    Sync
                  </button>
                  <button className="clear-btn" onClick={clearVotingList}>
                    Clear
                  </button>
                </>
              )}
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
        </section>
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowLoginModal(false)}
            >
              ×
            </button>
            <div className="login-content">
              <div className="spotify-logo">
                <svg viewBox="0 0 24 24" width="64" height="64">
                  <circle cx="12" cy="12" r="12" fill="#1DB954" />
                  <path
                    d="M17.9 10.9C14.7 9 9.4 8.8 6.4 9.7c-.5.1-1-.2-1.1-.7-.1-.5.2-1 .7-1.1 3.4-1.1 9.2-.9 12.8 1.3.5.3.6.9.3 1.4-.3.4-.9.5-1.2.3zm-.2 2.9c-.2.4-.7.5-1 .3-2.7-1.7-6.8-2.2-10-1.2-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.7-1.1 8.2-.6 11.3 1.4.3.2.4.7.2 1zm-1.2 2.8c-.2.3-.5.4-.8.2-2.4-1.4-5.3-1.7-8.8-.9-.3.1-.6-.2-.7-.5-.1-.3.2-.6.5-.7 3.8-.9 7.1-.5 9.7 1.1.3.2.4.5.1.8z"
                    fill="white"
                  />
                </svg>
              </div>
              <h2>Connect to Spotify</h2>
              <p>Log in with your Spotify account to sync your voting queue</p>
              <button
                className="spotify-login-btn"
                onClick={handleSpotifyLogin}
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <circle cx="12" cy="12" r="12" fill="currentColor" />
                  <path
                    d="M17.9 10.9C14.7 9 9.4 8.8 6.4 9.7c-.5.1-1-.2-1.1-.7-.1-.5.2-1 .7-1.1 3.4-1.1 9.2-.9 12.8 1.3.5.3.6.9.3 1.4-.3.4-.9.5-1.2.3zm-.2 2.9c-.2.4-.7.5-1 .3-2.7-1.7-6.8-2.2-10-1.2-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.7-1.1 8.2-.6 11.3 1.4.3.2.4.7.2 1zm-1.2 2.8c-.2.3-.5.4-.8.2-2.4-1.4-5.3-1.7-8.8-.9-.3.1-.6-.2-.7-.5-.1-.3.2-.6.5-.7 3.8-.9 7.1-.5 9.7 1.1.3.2.4.5.1.8z"
                    fill="#000"
                  />
                </svg>
                Continue with Spotify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync/Create Playlist Modal */}
      {showSyncModal && (
        <div className="modal-overlay" onClick={closeSyncModal}>
          <div className="sync-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeSyncModal}>
              ×
            </button>

            {syncState === "success" && createdPlaylist ? (
              <div className="sync-content sync-success">
                <div className="success-icon">✓</div>
                <h2>Playlist Created!</h2>
                <p className="playlist-info">
                  <strong>{createdPlaylist.name}</strong>
                  <br />
                  {createdPlaylist.tracks_added} tracks added
                </p>
                {createdPlaylist.url && (
                  <a
                    href={createdPlaylist.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="open-spotify-btn"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <circle cx="12" cy="12" r="12" fill="#1DB954" />
                      <path
                        d="M17.9 10.9C14.7 9 9.4 8.8 6.4 9.7c-.5.1-1-.2-1.1-.7-.1-.5.2-1 .7-1.1 3.4-1.1 9.2-.9 12.8 1.3.5.3.6.9.3 1.4-.3.4-.9.5-1.2.3zm-.2 2.9c-.2.4-.7.5-1 .3-2.7-1.7-6.8-2.2-10-1.2-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.7-1.1 8.2-.6 11.3 1.4.3.2.4.7.2 1zm-1.2 2.8c-.2.3-.5.4-.8.2-2.4-1.4-5.3-1.7-8.8-.9-.3.1-.6-.2-.7-.5-.1-.3.2-.6.5-.7 3.8-.9 7.1-.5 9.7 1.1.3.2.4.5.1.8z"
                        fill="white"
                      />
                    </svg>
                    Open in Spotify
                  </a>
                )}
                <button className="done-btn" onClick={closeSyncModal}>
                  Done
                </button>
              </div>
            ) : (
              <div className="sync-content">
                <div className="spotify-logo">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <circle cx="12" cy="12" r="12" fill="#1DB954" />
                    <path
                      d="M17.9 10.9C14.7 9 9.4 8.8 6.4 9.7c-.5.1-1-.2-1.1-.7-.1-.5.2-1 .7-1.1 3.4-1.1 9.2-.9 12.8 1.3.5.3.6.9.3 1.4-.3.4-.9.5-1.2.3zm-.2 2.9c-.2.4-.7.5-1 .3-2.7-1.7-6.8-2.2-10-1.2-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.7-1.1 8.2-.6 11.3 1.4.3.2.4.7.2 1zm-1.2 2.8c-.2.3-.5.4-.8.2-2.4-1.4-5.3-1.7-8.8-.9-.3.1-.6-.2-.7-.5-.1-.3.2-.6.5-.7 3.8-.9 7.1-.5 9.7 1.1.3.2.4.5.1.8z"
                      fill="white"
                    />
                  </svg>
                </div>
                <h2>Create Spotify Playlist</h2>
                <p className="sync-desc">
                  Create a new playlist with {queuedTracks.length} tracks sorted
                  by votes
                </p>

                <div className="playlist-name-input">
                  <label htmlFor="playlist-name">Playlist Name</label>
                  <input
                    id="playlist-name"
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    placeholder="Enter playlist name..."
                    disabled={syncState === "loading"}
                  />
                </div>

                {syncError && (
                  <div className="sync-error">
                    <span>❌</span> {syncError}
                  </div>
                )}

                <button
                  className="create-playlist-btn"
                  onClick={createPlaylist}
                  disabled={syncState === "loading" || !playlistName.trim()}
                >
                  {syncState === "loading" ? (
                    <>
                      <span className="spinner"></span>
                      Creating...
                    </>
                  ) : (
                    "Create Playlist"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
