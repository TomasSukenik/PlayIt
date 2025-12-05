import { kv } from "@vercel/kv";

// Spotify token cache for Client Credentials flow
let cachedToken: string | null = null;
let tokenExpiry = 0;

const clientId = process.env.SPOTIFY_CLIENT_ID!;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

export async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    throw new Error("Failed to get Spotify token");
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

  return cachedToken!;
}

// Generate random string for state parameter
export function generateRandomString(length: number): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

// Session stored in Vercel KV (Redis) for persistence across serverless invocations
export interface Session {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  user?: {
    id: string;
    displayName: string;
    email: string;
    imageUrl?: string;
    product: string;
  };
  created?: number;
}

const SESSION_PREFIX = "playit:session:";
const SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds

export async function getSession(
  sessionId: string
): Promise<Session | undefined> {
  const session = await kv.get<Session>(`${SESSION_PREFIX}${sessionId}`);
  return session ?? undefined;
}

export async function setSession(
  sessionId: string,
  session: Session
): Promise<void> {
  await kv.set(`${SESSION_PREFIX}${sessionId}`, session, { ex: SESSION_TTL });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await kv.del(`${SESSION_PREFIX}${sessionId}`);
}

