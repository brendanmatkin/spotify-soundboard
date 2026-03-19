# Spotify Soundboard

A local web app for triggering Spotify playlists from a tablet (or any browser). Shows a grid of playlist buttons — tap one to start playing via Spotify Connect. Designed to be fast on slow devices.

## Features

- Grid of playlist buttons with artwork
- Edit mode: add/remove/reorder playlists via search, library browse, or paste URL
- Custom images per button
- Player controls: play/pause, skip, shuffle, volume
- Track progress bar
- Device selector (Spotify Connect)
- Config persists on the server (works across devices)
- Auto-syncs between clients

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- A **Spotify Premium** account (required for playback control)
- A Spotify Developer app (free to create)

## Setup

### 1. Clone and install

```sh
git clone https://github.com/brendanmatkin/spotify-soundboard.git
cd spotify-soundboard
npm install
```

### 2. Create a Spotify app

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add a redirect URI: `http://127.0.0.1:5173/auth/callback`
4. Note your **Client ID** and **Client Secret**

### 3. Configure environment

Copy the example env file and fill in your credentials:

```sh
cp .env.example .env
```

Edit `.env`:

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
ORIGIN=http://127.0.0.1:5173
```

### 4. Run

```sh
npm run dev -- --host
```

Then open `http://127.0.0.1:5173` in a browser on the machine running the server. You'll be redirected to Spotify to log in. This only needs to happen once — tokens are stored on the server.

### 5. Access from a tablet

After logging in on the host machine, open `http://<your-computer-ip>:5173` on the tablet. No login needed — the tablet uses the server's stored tokens.

To find your computer's local IP: `ipconfig` (Windows) or `ifconfig` / `ip addr` (Mac/Linux).

## Production build

```sh
npm run build
HOST=0.0.0.0 PORT=3000 node build
```

If using port 3000 in production, add `http://127.0.0.1:3000/auth/callback` as a redirect URI in the Spotify Dashboard and update `ORIGIN` in `.env` accordingly.

## How it works

- **SvelteKit** app with `adapter-node` for local hosting
- All Spotify API calls happen server-side (tokens never reach the browser)
- Button config stored in `data/config.json`, custom images in `data/images/`
- Player state polls every 5 seconds (pauses when the tab is hidden)
