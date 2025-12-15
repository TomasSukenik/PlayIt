"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// User type from Spotify
interface SpotifyUser {
  id: string;
  displayName: string;
  email: string;
  imageUrl?: string;
  product: string;
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

// Polling interval for queue updates (2 seconds)
const POLL_INTERVAL = 2000;

export default function DJPage() {
  // Auth state
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Queue state (synced with server)
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
    updated: boolean;
  } | null>(null);
  const [playlistName, setPlaylistName] = useState("");

  // Selection state for queue management
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());

  // Playlist preload state
  const [playlistType, setPlaylistType] = useState<"my" | "public">("my");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [preloadError, setPreloadError] = useState<string | null>(null);

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

    if (!queueLoading && lastUpdated > 0) {
      pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL);
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [queueLoading, lastUpdated, fetchQueue]);

  // Handle Spotify login
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

  // Initialize playlist name when user logs in or tracks change
  useEffect(() => {
    if (user && !playlistName) {
      const date = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      setPlaylistName(`ZAHRAJ ČOSI Session - ${date}`);
    }
  }, [user, playlistName]);

  // Create the playlist
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
      const trackUris = queuedTracks.map((t) => `spotify:track:${t.spotifyId}`);

      const response = await fetch("/api/spotify/playlist/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          name: playlistName.trim(),
          description: `Created with ZAHRAJ ČOSI - ${queuedTracks.length} tracks sorted by votes`,
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
        updated: data.updated || false,
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

  // Reset sync state
  const resetSync = () => {
    setSyncState("idle");
    setSyncError(null);
    setCreatedPlaylist(null);
  };

  // Clear the voting queue
  const clearVotingList = async () => {
    try {
      const res = await fetch("/api/queue", {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setQueuedTracks(data.queue.tracks);
        setLastUpdated(data.queue.lastUpdated);
        setSelectedTracks(new Set());
      }
    } catch (error) {
      console.error("Error clearing queue:", error);
    }
  };

  // Toggle select all tracks
  const toggleSelectAll = () => {
    if (selectedTracks.size === queuedTracks.length) {
      setSelectedTracks(new Set());
    } else {
      setSelectedTracks(new Set(queuedTracks.map((t) => t.id)));
    }
  };

  // Toggle single track selection
  const toggleTrackSelection = (trackId: string) => {
    const newSelected = new Set(selectedTracks);
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId);
    } else {
      newSelected.add(trackId);
    }
    setSelectedTracks(newSelected);
  };

  // Remove selected tracks from queue
  const removeSelectedTracks = async () => {
    if (selectedTracks.size === 0) return;

    try {
      const res = await fetch("/api/queue/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackIds: Array.from(selectedTracks) }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueuedTracks(data.queue.tracks);
        setLastUpdated(data.queue.lastUpdated);
        setSelectedTracks(new Set());
      }
    } catch (error) {
      console.error("Error removing tracks:", error);
    }
  };

  // Search for playlists
  const searchPlaylists = async () => {
    setSearching(true);
    setPreloadError(null);
    try {
      if (playlistType === "my") {
        // Fetch user's playlists
        const sessionId = localStorage.getItem("sessionId");
        if (!sessionId) {
          setPreloadError("Please log in to view your playlists");
          setSearching(false);
          return;
        }

        const res = await fetch("/api/spotify/me/playlists?limit=50", {
          headers: { Authorization: `Bearer ${sessionId}` },
        });

        if (res.ok) {
          const data = await res.json();
          // Filter playlists by search query if provided
          const items = data.items || [];
          const filteredItems = searchQuery.trim()
            ? items.filter((playlist: any) =>
                playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : items;

          setSearchResults({
            playlists: {
              items: filteredItems,
              total: filteredItems.length,
            },
          });
        } else {
          setPreloadError("Failed to fetch your playlists");
        }
      } else {
        // Search public playlists
        if (!searchQuery.trim()) {
          setPreloadError("Please enter a search query");
          setSearching(false);
          return;
        }

        const res = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(
            searchQuery
          )}&type=playlist&limit=20`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        } else {
          setPreloadError("Failed to search playlists");
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      setPreloadError("Failed to search playlists");
    } finally {
      setSearching(false);
    }
  };

  // Load playlist tracks into queue
  const loadPlaylistToQueue = async (playlistId: string) => {
    setLoadingPlaylist(true);
    setPreloadError(null);
    try {
      // Fetch playlist details
      const playlistRes = await fetch(`/api/spotify/playlist/${playlistId}`);
      if (!playlistRes.ok) throw new Error("Failed to load playlist");
      const playlistData = await playlistRes.json();

      // Extract tracks with proper null checks
      const tracks = (playlistData.tracks?.items || [])
        .filter((item: any) => item?.track && item.track.id)
        .map((item: any) => {
          const track = item.track;
          return {
            spotifyId: track.id,
            name: track.name || "",
            artists:
              (track.artists || [])
                .map((a: any) => a?.name)
                .filter(Boolean)
                .join(", ") || "Unknown Artist",
            albumName: track.album?.name || "",
            albumArt:
              track.album?.images?.[2]?.url ||
              track.album?.images?.[0]?.url ||
              undefined,
            duration_ms: track.duration_ms || 0,
          };
        })
        .slice(0, 30); // Max 30 tracks

      if (tracks.length === 0) {
        throw new Error("No valid tracks found in playlist");
      }

      // Add tracks to queue
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks, replaceAll: false }),
      });

      if (res.ok) {
        const data = await res.json();
        setQueuedTracks(data.queue.tracks);
        setLastUpdated(data.queue.lastUpdated);
        setSearchQuery("");
        setSearchResults(null);
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add tracks to queue");
      }
    } catch (error) {
      console.error("Error loading playlist:", error);
      setPreloadError(
        error instanceof Error ? error.message : "Failed to load playlist"
      );
    } finally {
      setLoadingPlaylist(false);
    }
  };

  return (
    <div className="dj-page">
      <header className="dj-header">
        <div className="dj-header-left">
          <a href="/" className="dj-back-link">
            ← Back to Voting
          </a>
          <h1 className="dj-title">DJ Dashboard</h1>
        </div>
        <div className="dj-header-right">
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
          ) : null}
        </div>
      </header>

      <main className="dj-main">
        {authLoading ? (
          <div className="dj-loading">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        ) : !user ? (
          <div className="dj-login-section">
            <div className="dj-login-card">
              <div className="spotify-logo-large">
                <svg viewBox="0 0 24 24" width="80" height="80">
                  <circle cx="12" cy="12" r="12" fill="#1DB954" />
                  <path
                    d="M17.9 10.9C14.7 9 9.4 8.8 6.4 9.7c-.5.1-1-.2-1.1-.7-.1-.5.2-1 .7-1.1 3.4-1.1 9.2-.9 12.8 1.3.5.3.6.9.3 1.4-.3.4-.9.5-1.2.3zm-.2 2.9c-.2.4-.7.5-1 .3-2.7-1.7-6.8-2.2-10-1.2-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.7-1.1 8.2-.6 11.3 1.4.3.2.4.7.2 1zm-1.2 2.8c-.2.3-.5.4-.8.2-2.4-1.4-5.3-1.7-8.8-.9-.3.1-.6-.2-.7-.5-.1-.3.2-.6.5-.7 3.8-.9 7.1-.5 9.7 1.1.3.2.4.5.1.8z"
                    fill="white"
                  />
                </svg>
              </div>
              <h2>Connect to Spotify</h2>
              <p>
                Log in with your Spotify account to sync your voting queue to a
                playlist
              </p>
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
        ) : (
          <div className="dj-dashboard">
            {/* Preload Playlist Section */}
            <section className="dj-preload-section">
              <h2 className="playlist-type-header">Preload from Spotify</h2>
              <div className="dj-preload-form">
                <p className="preload-desc">
                  <button
                    className={`playlist-type-btn ${
                      playlistType === "my" ? "active" : ""
                    }`}
                    onClick={() => {
                      setPlaylistType("my");
                      setSearchResults(null);
                      setSearchQuery("");
                    }}
                  >
                    My
                  </button>{" "}
                  <button
                    className={`playlist-type-btn ${
                      playlistType === "public" ? "active" : ""
                    }`}
                    onClick={() => {
                      setPlaylistType("public");
                      setSearchResults(null);
                      setSearchQuery("");
                    }}
                  >
                    Public
                  </button>
                </p>

                <div className="search-input-group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && searchPlaylists()}
                    placeholder="Search for a playlist..."
                    disabled={searching || loadingPlaylist}
                    className="playlist-search-input"
                  />
                  <button
                    className="dj-btn secondary"
                    onClick={searchPlaylists}
                    disabled={
                      searching ||
                      (playlistType === "public" && !searchQuery.trim()) ||
                      loadingPlaylist
                    }
                  >
                    {searching ? (
                      <>
                        <span className="spinner-small"></span>
                        {playlistType === "my" ? "Loading..." : "Searching..."}
                      </>
                    ) : playlistType === "my" ? (
                      "Load"
                    ) : (
                      "Search"
                    )}
                  </button>
                </div>

                {preloadError && (
                  <div className="sync-error">
                    <span>❌</span> {preloadError}
                  </div>
                )}

                {searchResults?.playlists?.items && (
                  <div className="playlist-results">
                    {searchResults.playlists.items.length === 0 ? (
                      <p className="no-results">No playlists found</p>
                    ) : (
                      searchResults.playlists.items
                        .filter((playlist: any) => playlist?.id)
                        .map((playlist: any) => (
                          <div
                            key={playlist.id}
                            className="playlist-result-item"
                          >
                            {playlist.images?.[0]?.url && (
                              <img
                                src={playlist.images[0].url}
                                alt=""
                                className="playlist-thumb"
                              />
                            )}
                            <div className="playlist-info">
                              <h4>{playlist.name || "Unnamed Playlist"}</h4>
                              <p>
                                {playlist.tracks?.total || 0} tracks •{" "}
                                {playlist.owner?.display_name || "Unknown"}
                              </p>
                            </div>
                            <button
                              className="dj-btn primary"
                              onClick={() => loadPlaylistToQueue(playlist.id)}
                              disabled={loadingPlaylist}
                            >
                              {loadingPlaylist ? (
                                <>
                                  <span className="spinner-small"></span>
                                  Loading...
                                </>
                              ) : (
                                "Load to Queue"
                              )}
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Sync Section */}
            <section className="dj-sync-section">
              <h2>Sync to Spotify</h2>

              {syncState === "success" && createdPlaylist ? (
                <div className="dj-sync-success">
                  <div className="success-icon">✓</div>
                  <h3>
                    Playlist {createdPlaylist.updated ? "Updated" : "Created"}!
                  </h3>
                  <p className="playlist-info">
                    <strong>{createdPlaylist.name}</strong>
                    <br />
                    {createdPlaylist.tracks_added} tracks{" "}
                    {createdPlaylist.updated ? "synced" : "added"}
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
                  <button className="dj-btn secondary" onClick={resetSync}>
                    Sync Again
                  </button>
                </div>
              ) : (
                <div className="dj-sync-form">
                  <p className="sync-desc">
                    Creates new or updates existing playlist
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
                    className="dj-btn primary"
                    onClick={createPlaylist}
                    disabled={
                      syncState === "loading" ||
                      !playlistName.trim() ||
                      queuedTracks.length === 0
                    }
                  >
                    {syncState === "loading" ? (
                      <>
                        <span className="spinner-small"></span>
                        Syncing...
                      </>
                    ) : (
                      "Sync to Spotify"
                    )}
                  </button>
                </div>
              )}
            </section>

            {/* Queue Preview */}
            <section className="dj-queue-section">
              <div className="dj-queue-header">
                <h2>Current Queue</h2>
                <div className="dj-queue-actions">
                  <span className="track-count">
                    {queuedTracks.length} tracks
                  </span>
                  {queuedTracks.length > 0 && (
                    <>
                      {selectedTracks.size > 0 && (
                        <button
                          className="dj-btn danger"
                          onClick={removeSelectedTracks}
                        >
                          Remove Selected ({selectedTracks.size})
                        </button>
                      )}
                      <button
                        className="dj-btn danger"
                        onClick={clearVotingList}
                      >
                        Clear All
                      </button>
                    </>
                  )}
                </div>
              </div>

              {queueLoading ? (
                <div className="dj-queue-loading">Loading queue...</div>
              ) : queuedTracks.length === 0 ? (
                <div className="dj-queue-empty">
                  <p>No songs in the queue yet</p>
                  <a href="/" className="dj-btn secondary">
                    Go to Voting Page
                  </a>
                </div>
              ) : (
                <>
                  <div className="dj-queue-controls">
                    <label className="dj-select-all">
                      <input
                        type="checkbox"
                        checked={selectedTracks.size === queuedTracks.length}
                        onChange={toggleSelectAll}
                      />
                      <span>Select all</span>
                    </label>
                    {selectedTracks.size > 0 &&
                      selectedTracks.size < queuedTracks.length && (
                        <span className="dj-selection-count">
                          {selectedTracks.size} selected
                        </span>
                      )}
                  </div>
                  <ul className="dj-queue-list">
                    {queuedTracks.map((track, index) => (
                      <li
                        key={track.id}
                        className={`dj-queue-item ${
                          selectedTracks.has(track.id) ? "selected" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="dj-queue-checkbox"
                          checked={selectedTracks.has(track.id)}
                          onChange={() => toggleTrackSelection(track.id)}
                        />
                        <span className="dj-queue-rank">{index + 1}</span>
                        {track.albumArt && (
                          <img
                            src={track.albumArt}
                            alt=""
                            className="dj-queue-art"
                          />
                        )}
                        <div className="dj-queue-info">
                          <span className="dj-queue-title">{track.name}</span>
                          <span className="dj-queue-artist">
                            {track.artists}
                          </span>
                        </div>
                        <span className="dj-queue-votes">
                          {track.votes} votes
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
