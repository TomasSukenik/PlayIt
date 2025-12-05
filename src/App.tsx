import { useCallback, useEffect, useState } from "react";
import "./App.css";

interface Song {
  id: number;
  title: string;
  artist: string;
  votes: number;
}

interface SpotifyTrack {
  track: {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
    external_urls: { spotify: string };
    duration_ms: number;
  };
}

interface SpotifyPlaylistFull {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  owner: { display_name: string };
  tracks: {
    total: number;
    items: SpotifyTrack[];
  };
  external_urls: { spotify: string };
}

function SongItem({
  song,
  rank,
  onUpvote,
}: {
  song: Song;
  rank: number;
  onUpvote: (id: number) => void;
}) {
  return (
    <li className="song-item" onClick={() => onUpvote(song.id)}>
      <span className="rank">{rank}</span>
      <div className="song-info">
        <span className="title">{song.title}</span>
        <span className="artist">{song.artist}</span>
      </div>
      <div className="votes">
        <span className="arrow">▲</span>
        <span className="vote-count">{song.votes}</span>
      </div>
    </li>
  );
}

function SpotifyTrackItem({
  track,
  index,
}: {
  track: SpotifyTrack;
  index: number;
}) {
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!track.track) return null;

  return (
    <li className="song-item spotify-track">
      <span className="rank">{index + 1}</span>
      {track.track.album.images?.[2] && (
        <img
          src={track.track.album.images[2].url}
          alt=""
          className="track-art"
        />
      )}
      <div className="song-info">
        <span className="title">{track.track.name}</span>
        <span className="artist">
          {track.track.artists.map((a) => a.name).join(", ")}
        </span>
      </div>
      <span className="duration">
        {formatDuration(track.track.duration_ms)}
      </span>
    </li>
  );
}

// Extract playlist ID from Spotify URL or return as-is if already an ID
function extractPlaylistId(input: string): string {
  // Handle Spotify URLs like:
  // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
  // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const urlMatch = input.match(/playlist[/:]([a-zA-Z0-9]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  // If no match, assume it's already a playlist ID
  return input.trim();
}

function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<SpotifyPlaylistFull | null>(null);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlistInput, setPlaylistInput] = useState("");
  const [view, setView] = useState<"voting" | "spotify">("spotify");

  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3001/api/songs");
      const data = await res.json();
      setSongs(data);
    } catch (error) {
      console.error("Failed to fetch songs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const fetchPlaylist = async (input: string) => {
    const id = extractPlaylistId(input);
    if (!id) return;

    setLoadingPlaylist(true);
    setPlaylistError(null);

    try {
      const res = await fetch(
        `http://localhost:3001/api/spotify/playlist/${id}`
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch playlist");
      }
      const data = await res.json();
      setPlaylist(data);
    } catch (error) {
      console.error("Failed to fetch playlist:", error);
      setPlaylistError(
        error instanceof Error ? error.message : "Failed to load playlist"
      );
      setPlaylist(null);
    } finally {
      setLoadingPlaylist(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playlistInput.trim()) {
      fetchPlaylist(playlistInput);
    }
  };

  const handleUpvote = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3001/api/songs/${id}/upvote`, {
        method: "POST",
      });
      const data = await res.json();
      setSongs(data);
    } catch (error) {
      console.error("Failed to upvote:", error);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">PlayIt</h1>
        <nav className="nav">
          <button
            className={`nav-btn ${view === "voting" ? "active" : ""}`}
            onClick={() => setView("voting")}
          >
            Voting
          </button>
          <button
            className={`nav-btn ${view === "spotify" ? "active" : ""}`}
            onClick={() => setView("spotify")}
          >
            <span className="spotify-icon">●</span> Spotify
          </button>
        </nav>
      </header>

      <main className="content">
        {view === "voting" ? (
          <section className="playlist">
            <ul className="song-list">
              {songs.map((song, index) => (
                <SongItem
                  key={song.id}
                  song={song}
                  rank={index + 1}
                  onUpvote={handleUpvote}
                />
              ))}
            </ul>
          </section>
        ) : (
          <section className="spotify-section">
            <div className="spotify-content">
              <div className="playlist-search">
                <h2>View Spotify Playlist</h2>
                <p className="search-hint">
                  Enter a Spotify playlist URL or ID to display it
                </p>
                <form onSubmit={handleSubmit} className="search-form">
                  <input
                    type="text"
                    value={playlistInput}
                    onChange={(e) => setPlaylistInput(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/... or playlist ID"
                    className="playlist-input"
                  />
                  <button
                    type="submit"
                    className="load-btn"
                    disabled={loadingPlaylist || !playlistInput.trim()}
                  >
                    {loadingPlaylist ? "Loading..." : "Load Playlist"}
                  </button>
                </form>

                <div className="example-playlists">
                  <span className="example-label">Try these:</span>
                  <button
                    className="example-btn"
                    onClick={() => {
                      setPlaylistInput("37i9dQZF1DXcBWIGoYBM5M");
                      fetchPlaylist("37i9dQZF1DXcBWIGoYBM5M");
                    }}
                  >
                    Today's Top Hits
                  </button>
                  <button
                    className="example-btn"
                    onClick={() => {
                      setPlaylistInput("37i9dQZF1DX0XUsuxWHRQd");
                      fetchPlaylist("37i9dQZF1DX0XUsuxWHRQd");
                    }}
                  >
                    RapCaviar
                  </button>
                  <button
                    className="example-btn"
                    onClick={() => {
                      setPlaylistInput("37i9dQZF1DWXRqgorJj26U");
                      fetchPlaylist("37i9dQZF1DWXRqgorJj26U");
                    }}
                  >
                    Rock Classics
                  </button>
                </div>
              </div>

              {playlistError && (
                <div className="playlist-error">
                  <p>❌ {playlistError}</p>
                  <p className="error-hint">
                    Make sure the playlist is public and the ID is correct
                  </p>
                </div>
              )}

              {loadingPlaylist && (
                <div className="loading-tracks">Loading playlist...</div>
              )}

              {playlist && !loadingPlaylist && (
                <div className="selected-playlist">
                  <div className="playlist-header">
                    {playlist.images?.[0] && (
                      <img
                        src={playlist.images[0].url}
                        alt=""
                        className="playlist-cover"
                      />
                    )}
                    <div className="playlist-title">
                      <h3>{playlist.name}</h3>
                      <span className="playlist-owner">
                        by {playlist.owner.display_name}
                      </span>
                      <span className="track-count">
                        {playlist.tracks.total} tracks
                      </span>
                      <a
                        href={playlist.external_urls.spotify}
                        target="_blank"
                        rel="noreferrer"
                        className="open-spotify-link"
                      >
                        Open in Spotify ↗
                      </a>
                    </div>
                  </div>
                  <ul className="song-list">
                    {playlist.tracks.items.map((item, index) => (
                      <SpotifyTrackItem
                        key={item.track?.id || index}
                        track={item}
                        index={index}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
