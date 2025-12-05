# PlayIt

Search music & vote for what plays next - A Spotify-powered music voting app.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Spotify Web API** - Music search and playback

## Getting Started

### Prerequisites

1. Create a Spotify Developer App at https://developer.spotify.com/dashboard
2. Add your redirect URI to your Spotify app settings:
   - For local development: `http://localhost:3000/callback`
   - For production: `https://your-vercel-url.vercel.app/callback`

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Spotify API credentials
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# App URL (for OAuth redirect)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Deploying to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add the environment variables in Vercel's project settings:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `NEXT_PUBLIC_APP_URL` (your Vercel production URL)
4. Update your Spotify app's redirect URI to include your Vercel URL

## Features

- 🔍 Search for songs, albums, playlists, and artists
- 📋 Build a voting queue from search results
- 🗳️ Vote for your favorite tracks
- 🔐 Spotify OAuth authentication
- 📱 Responsive design

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/         # OAuth endpoints
│   │   └── spotify/      # Spotify API proxy
│   ├── callback/         # OAuth callback page
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/
│   └── PlayItApp.tsx     # Main app component
├── lib/
│   └── spotify.ts        # Spotify utilities
└── next.config.ts        # Next.js configuration
```
