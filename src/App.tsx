import { useState } from "react";
import "./App.css";

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

interface VoteableSong {
  spotifyId: string;
  title: string;
  artist: string;
  albumArt?: string;
  votes: number;
}

type SearchType = "track" | "album" | "playlist" | "artist";

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

function App() {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("track");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected content state
  const [selectedPlaylist, setSelectedPlaylist] =
    useState<SpotifyPlaylistFull | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbumFull | null>(
    null
  );
  const [loadingContent, setLoadingContent] = useState(false);

  // Voting state
  const [votingTracks, setVotingTracks] = useState<SpotifyTrackSimple[]>([]);
  const [spotifyVotes, setSpotifyVotes] = useState<Record<string, number>>({});

  // Track IDs that are in the voting list
  const votingTrackIds = new Set(votingTracks.map((t) => t.id));

  // Convert tracks to voteable songs (limited to 30)
  const voteableSongs: VoteableSong[] = votingTracks
    .slice(0, 30)
    .map((track) => ({
      spotifyId: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      albumArt: track.album?.images?.[2]?.url,
      votes: spotifyVotes[track.id] || 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  const handleSpotifyUpvote = (spotifyId: string) => {
    setSpotifyVotes((prev) => ({
      ...prev,
      [spotifyId]: (prev[spotifyId] || 0) + 1,
    }));
  };

  const handleRemoveTrack = (spotifyId: string) => {
    setVotingTracks((prev) => prev.filter((t) => t.id !== spotifyId));
  };

  // Search Spotify
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSelectedPlaylist(null);
    setSelectedAlbum(null);

    try {
      const res = await fetch(
        `http://localhost:3001/api/spotify/search?q=${encodeURIComponent(
          searchQuery
        )}&type=${searchType}&limit=20`
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
  };

  // Load full playlist
  const loadPlaylist = async (playlist: SpotifyPlaylist) => {
    setLoadingContent(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/spotify/playlist/${playlist.id}`
      );
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
      const res = await fetch(
        `http://localhost:3001/api/spotify/album/${album.id}`
      );
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

  // Add single track to voting
  const addTrackToVoting = (track: SpotifyTrackSimple) => {
    if (votingTracks.some((t) => t.id === track.id)) return;
    if (votingTracks.length >= 30) return; // Max 30 tracks
    setVotingTracks((prev) => [...prev, track]);
  };

  // Load all tracks from playlist to voting
  const loadPlaylistToVoting = (playlist: SpotifyPlaylistFull) => {
    const tracks = playlist.tracks.items
      .filter((item) => item.track)
      .map((item) => item.track)
      .slice(0, 30);
    setVotingTracks(tracks);
    setSpotifyVotes({});
  };

  // Load all tracks from album to voting
  const loadAlbumToVoting = (album: SpotifyAlbumFull) => {
    const tracks: SpotifyTrackSimple[] = album.tracks.items
      .map((t) => ({
        ...t,
        album: album,
        external_urls: { spotify: "" },
      }))
      .slice(0, 30);
    setVotingTracks(tracks);
    setSpotifyVotes({});
  };

  // Clear selection and go back to search
  const clearSelection = () => {
    setSelectedPlaylist(null);
    setSelectedAlbum(null);
  };

  const clearVotingList = () => {
    setVotingTracks([]);
    setSpotifyVotes({});
  };

  const searchTypes: { value: SearchType; label: string }[] = [
    { value: "track", label: "Songs" },
    { value: "album", label: "Albums" },
    { value: "playlist", label: "Playlists" },
    { value: "artist", label: "Artists" },
  ];

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">PlayIt</h1>
        <p className="tagline">Search music & vote for what plays next</p>
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
                placeholder="Search songs, albums, playlists..."
                className="search-input"
              />
              <button
                type="submit"
                className="search-btn"
                disabled={searching || !searchQuery.trim()}
              >
                {searching ? "..." : "Search"}
              </button>
            </form>

            <div className="search-type-tabs">
              {searchTypes.map((type) => (
                <button
                  key={type.value}
                  className={`type-tab ${
                    searchType === type.value ? "active" : ""
                  }`}
                  onClick={() => setSearchType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>
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
                {searchType === "track" && searchResults.tracks && (
                  <ul className="results-list">
                    {searchResults.tracks.items.map((track) => (
                      <TrackResultItem
                        key={track.id}
                        track={track}
                        onSelect={addTrackToVoting}
                        isAdded={votingTrackIds.has(track.id)}
                      />
                    ))}
                  </ul>
                )}

                {searchType === "album" && searchResults.albums && (
                  <ul className="results-list">
                    {searchResults.albums.items.map((album) => (
                      <AlbumResultItem
                        key={album.id}
                        album={album}
                        onSelect={loadAlbum}
                      />
                    ))}
                  </ul>
                )}

                {searchType === "playlist" && searchResults.playlists && (
                  <ul className="results-list">
                    {searchResults.playlists.items.map((playlist) => (
                      <PlaylistResultItem
                        key={playlist.id}
                        playlist={playlist}
                        onSelect={loadPlaylist}
                      />
                    ))}
                  </ul>
                )}

                {searchType === "artist" && searchResults.artists && (
                  <ul className="results-list">
                    {searchResults.artists.items.map((artist) => (
                      <ArtistResultItem
                        key={artist.id}
                        artist={artist}
                        onSelect={() => {
                          setSearchQuery(artist.name);
                          setSearchType("track");
                        }}
                      />
                    ))}
                  </ul>
                )}
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
            <h2>Voting Queue</h2>
            {voteableSongs.length > 0 && (
              <button className="clear-btn" onClick={clearVotingList}>
                Clear all
              </button>
            )}
          </div>

          {voteableSongs.length > 0 ? (
            <>
              <p className="song-count">{voteableSongs.length} songs</p>
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
    </div>
  );
}

export default App;
