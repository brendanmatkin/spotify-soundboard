import { json, error } from "@sveltejs/kit";
import { getState, play, pause, next, previous, setShuffle, setVolume } from "$lib/server/sonos";
import {
  getPlayerState,
  pause as spotifyPause,
  resume as spotifyResume,
  setShuffle as spotifySetShuffle,
  setVolume as spotifySetVolume,
  skipNext,
  skipPrev,
} from "$lib/server/spotify";
import { getAccessToken } from "$lib/server/tokens";
import { readConfig } from "$lib/server/config";
import type { RequestHandler } from "./$types";

function extractPlaylistContextUri(input?: string | null): string | null {
  if (!input) return null;

  let value = input;
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }

  const normalized = value.replace(/^x-sonos-spotify:/, "");
  const plain = normalized.match(/spotify:playlist:([A-Za-z0-9]+)/i);
  if (plain) return `spotify:playlist:${plain[1]}`;

  const legacy = normalized.match(/spotify:user:spotify:playlist:([A-Za-z0-9]+)/i);
  if (legacy) return `spotify:playlist:${legacy[1]}`;

  return null;
}

function normalizeSpotifyState(state: any) {
  return {
    backend: "spotify" as const,
    playbackState: state.is_playing ? "PLAYING" : "PAUSED_PLAYBACK",
    playMode: {
      shuffle: state.shuffle_state ?? false,
      repeat: state.repeat_state ?? "off",
      crossfade: false,
    },
    contextUri: state.context?.uri ?? null,
    currentTrack: {
      title: state.item?.name ?? null,
      artist: state.item?.artists?.map((a: { name: string }) => a.name).join(", ") ?? null,
      duration: Math.floor((state.item?.duration_ms ?? 0) / 1000),
      uri: state.item?.uri ?? "",
    },
    volume: state.device?.volume_percent ?? 0,
    elapsedTime: Math.floor((state.progress_ms ?? 0) / 1000),
  };
}

export const GET: RequestHandler = async () => {
  const config = await readConfig();

  if (config.playback_backend === "spotify") {
    const token = await getAccessToken();
    const state = await getPlayerState(token);
    if (!state) return json(null);

    return json(normalizeSpotifyState(state));
  }

  // When Sonos is selected, still prefer Spotify if a Spotify Connect session
  // is currently active. This keeps the UI/backend indicator in sync after fresh start.
  try {
    const token = await getAccessToken();
    const spotifyState = await getPlayerState(token);
    if (spotifyState?.is_playing) {
      return json(normalizeSpotifyState(spotifyState));
    }
  } catch {
    /* ignore spotify detection failures */
  }

  const sonosState = await getState();

  if (!sonosState) return json(null);

  return json({
    backend: "sonos" as const,
    ...sonosState,
    contextUri: extractPlaylistContextUri(
      sonosState.nextTrack?.uri ?? sonosState.currentTrack?.uri,
    ),
  });
};

export const POST: RequestHandler = async ({ request }) => {
  const { action, value } = await request.json();
  const config = await readConfig();

  try {
    if (config.playback_backend === "spotify") {
      const token = await getAccessToken();
      switch (action) {
        case "pause":
          await spotifyPause(token);
          break;
        case "stop":
          await spotifyPause(token);
          break;
        case "resume":
          await spotifyResume(token);
          break;
        case "next":
          await skipNext(token);
          break;
        case "prev":
          await skipPrev(token);
          break;
        case "shuffle":
          await spotifySetShuffle(token, Boolean(value));
          break;
        case "volume":
          await spotifySetVolume(token, Number(value));
          break;
        default:
          throw error(400, `Unknown action: ${action}`);
      }
    } else {
      switch (action) {
        case "pause":
          await pause();
          break;
        case "stop":
          await pause();
          break;
        case "resume":
          await play();
          break;
        case "next":
          await next();
          break;
        case "prev":
          await previous();
          break;
        case "shuffle":
          await setShuffle(Boolean(value));
          break;
        case "volume":
          await setVolume(Number(value));
          break;
        default:
          throw error(400, `Unknown action: ${action}`);
      }
    }
  } catch (e) {
    throw error(502, (e as Error).message);
  }

  return json({ ok: true });
};
