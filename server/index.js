import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Spotify credentials
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

// Cache token to avoid requesting a new one for every API call
let cachedToken = null;
let tokenExpiry = 0;

// Get Spotify access token using Client Credentials Flow (no user login needed)
async function getSpotifyToken() {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        },
      }
    );

    cachedToken = response.data.access_token;
    // Set expiry 5 minutes before actual expiry to be safe
    tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

    console.log("Spotify token obtained successfully");
    return cachedToken;
  } catch (error) {
    console.error("Error getting Spotify token:", error.response?.data || error.message);
    throw error;
  }
}

// In-memory song data (fallback/demo)
const songs = [
  { id: 1, title: "Bohemian Rhapsody", artist: "Queen", votes: 12 },
  { id: 2, title: "Stairway to Heaven", artist: "Led Zeppelin", votes: 8 },
  { id: 3, title: "Hotel California", artist: "Eagles", votes: 15 },
  { id: 4, title: "Comfortably Numb", artist: "Pink Floyd", votes: 6 },
  { id: 5, title: "Sweet Child O' Mine", artist: "Guns N' Roses", votes: 10 },
  { id: 6, title: "Smells Like Teen Spirit", artist: "Nirvana", votes: 9 },
  { id: 7, title: "Back in Black", artist: "AC/DC", votes: 7 },
  { id: 8, title: "Imagine", artist: "John Lennon", votes: 11 },
  { id: 9, title: "Purple Rain", artist: "Prince", votes: 5 },
  { id: 10, title: "Like a Rolling Stone", artist: "Bob Dylan", votes: 4 },
];

// GET /api/songs - returns all songs sorted by votes (descending)
app.get("/api/songs", (req, res) => {
  const sortedSongs = [...songs].sort((a, b) => b.votes - a.votes);
  res.json(sortedSongs);
});

// POST /api/songs/:id/upvote - increments vote count for a song
app.post("/api/songs/:id/upvote", (req, res) => {
  const id = parseInt(req.params.id);
  const song = songs.find((s) => s.id === id);

  if (!song) {
    return res.status(404).json({ error: "Song not found" });
  }

  song.votes += 1;
  const sortedSongs = [...songs].sort((a, b) => b.votes - a.votes);
  res.json(sortedSongs);
});

// ============ SPOTIFY API ROUTES (Client Credentials - No Login Required) ============

// Get a public playlist by ID
app.get("/api/spotify/playlist/:id", async (req, res) => {
  try {
    const token = await getSpotifyToken();
    const playlistRes = await axios.get(
      `https://api.spotify.com/v1/playlists/${req.params.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { market: "US" }, // Add market for regional content
      }
    );
    res.json(playlistRes.data);
  } catch (error) {
    console.error("Error fetching playlist:", error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: "Playlist not found or not available in your region" });
    }
    if (error.response?.status === 400) {
      return res.status(400).json({ error: "Invalid playlist ID" });
    }
    
    res.status(500).json({ error: "Failed to fetch playlist" });
  }
});

// Get track details by ID
app.get("/api/spotify/track/:id", async (req, res) => {
  try {
    const token = await getSpotifyToken();
    const trackRes = await axios.get(
      `https://api.spotify.com/v1/tracks/${req.params.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    res.json(trackRes.data);
  } catch (error) {
    console.error("Error fetching track:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch track" });
  }
});

// Search for playlists, tracks, artists, etc.
app.get("/api/spotify/search", async (req, res) => {
  const { q, type = "playlist", limit = 20 } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Search query (q) is required" });
  }

  try {
    const token = await getSpotifyToken();
    const searchRes = await axios.get("https://api.spotify.com/v1/search", {
      headers: { Authorization: `Bearer ${token}` },
      params: { q, type, limit },
    });
    res.json(searchRes.data);
  } catch (error) {
    console.error("Error searching:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to search" });
  }
});

// Get featured playlists (Spotify editorial playlists)
app.get("/api/spotify/featured", async (req, res) => {
  try {
    const token = await getSpotifyToken();
    const featuredRes = await axios.get(
      "https://api.spotify.com/v1/browse/featured-playlists",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 20 },
      }
    );
    res.json(featuredRes.data);
  } catch (error) {
    console.error("Error fetching featured playlists:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch featured playlists" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Using Spotify Client Credentials Flow (no login required)");
});
