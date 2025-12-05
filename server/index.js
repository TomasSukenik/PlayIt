import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = 3001;
const FRONTEND_URL = "https://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

// Spotify credentials
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = `${FRONTEND_URL}/callback`;

// In-memory session store (in production, use Redis or database)
const sessions = new Map();

// Cache token for Client Credentials flow (public API calls)
let cachedToken = null;
let tokenExpiry = 0;

// Generate random string for state parameter
function generateRandomString(length) {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

// Get Spotify access token using Client Credentials Flow (no user login needed)
async function getSpotifyToken() {
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
    tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

    console.log("Spotify token obtained successfully");
    return cachedToken;
  } catch (error) {
    console.error(
      "Error getting Spotify token:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// ============ SPOTIFY OAUTH ROUTES ============

// Step 1: Redirect user to Spotify authorization
app.get("/api/auth/login", (req, res) => {
  const state = generateRandomString(16);
  const scope = [
    "user-read-private",
    "user-read-email",
    "playlist-modify-public",
    "playlist-modify-private",
    "streaming",
    "user-read-playback-state",
    "user-modify-playback-state",
  ].join(" ");

  // Store state for verification
  sessions.set(state, { created: Date.now() });

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  res.json({ url: authUrl.toString() });
});

// Step 2: Handle callback from Spotify
app.post("/api/auth/callback", async (req, res) => {
  const { code, state } = req.body;

  // Verify state
  if (!state || !sessions.has(state)) {
    return res.status(400).json({ error: "Invalid state parameter" });
  }
  sessions.delete(state);

  if (!code) {
    return res.status(400).json({ error: "Authorization code is required" });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user profile
    const userResponse = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = userResponse.data;

    // Create session
    const sessionId = generateRandomString(32);
    sessions.set(sessionId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      user: {
        id: user.id,
        displayName: user.display_name,
        email: user.email,
        imageUrl: user.images?.[0]?.url,
        product: user.product,
      },
    });

    res.json({
      sessionId,
      user: sessions.get(sessionId).user,
      expiresIn: expires_in,
    });
  } catch (error) {
    console.error(
      "Error exchanging code for token:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to authenticate with Spotify" });
  }
});

// Get current user (requires session)
app.get("/api/auth/me", async (req, res) => {
  const sessionId = req.headers.authorization?.replace("Bearer ", "");

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const session = sessions.get(sessionId);

  // Check if token needs refresh
  if (Date.now() > session.expiresAt - 60000) {
    try {
      const refreshResponse = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: session.refreshToken,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
          },
        }
      );

      session.accessToken = refreshResponse.data.access_token;
      session.expiresAt =
        Date.now() + refreshResponse.data.expires_in * 1000;
      if (refreshResponse.data.refresh_token) {
        session.refreshToken = refreshResponse.data.refresh_token;
      }
    } catch (error) {
      console.error("Error refreshing token:", error.response?.data);
      sessions.delete(sessionId);
      return res.status(401).json({ error: "Session expired" });
    }
  }

  res.json({ user: session.user });
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  const sessionId = req.headers.authorization?.replace("Bearer ", "");

  if (sessionId) {
    sessions.delete(sessionId);
  }

  res.json({ success: true });
});

// Get access token for authenticated user (for Spotify Web Playback SDK)
app.get("/api/auth/token", (req, res) => {
  const sessionId = req.headers.authorization?.replace("Bearer ", "");

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const session = sessions.get(sessionId);
  res.json({ accessToken: session.accessToken });
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
        params: { market: "US" },
      }
    );
    res.json(playlistRes.data);
  } catch (error) {
    console.error(
      "Error fetching playlist:",
      error.response?.data || error.message
    );

    if (error.response?.status === 404) {
      return res
        .status(404)
        .json({ error: "Playlist not found or not available in your region" });
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
    console.error(
      "Error fetching track:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch track" });
  }
});

// Get album details by ID
app.get("/api/spotify/album/:id", async (req, res) => {
  try {
    const token = await getSpotifyToken();
    const albumRes = await axios.get(
      `https://api.spotify.com/v1/albums/${req.params.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { market: "US" },
      }
    );
    res.json(albumRes.data);
  } catch (error) {
    console.error(
      "Error fetching album:",
      error.response?.data || error.message
    );

    if (error.response?.status === 404) {
      return res.status(404).json({ error: "Album not found" });
    }

    res.status(500).json({ error: "Failed to fetch album" });
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
    console.error(
      "Error fetching featured playlists:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to fetch featured playlists" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Redirect URI: ${redirectUri}`);
  console.log("\nMake sure to add this redirect URI to your Spotify app:");
  console.log(`  ${redirectUri}`);
});
