import { env } from "$env/dynamic/private";

const BASE = env.SONOS_API_URL ?? "http://localhost:5005";
const ROOM = encodeURIComponent(env.SONOS_ROOM ?? "");

async function sonosFetch(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`);
}

export interface SonosState {
  currentTrack: {
    artist: string;
    title: string;
    album: string;
    albumArtUri: string;
    duration: number;
    uri: string;
  };
  nextTrack: {
    artist?: string;
    title?: string;
    album?: string;
    albumArtUri?: string;
    duration?: number;
    uri?: string;
  };
  volume: number;
  mute: boolean;
  trackNo: number;
  elapsedTime: number;
  elapsedTimeFormatted: string;
  playbackState: string;
  playMode: {
    shuffle: boolean;
    repeat: string;
    crossfade: boolean;
  };
}

export interface SonosZone {
  coordinator: {
    uuid: string;
    roomName: string;
    state: { volume: number; mute: boolean; playerState: string };
  };
  members: Array<{
    uuid: string;
    roomName: string;
    state: { volume: number; mute: boolean };
  }>;
}

export async function getState(): Promise<SonosState | null> {
  try {
    const res = await sonosFetch(`/${ROOM}/state`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getZones(): Promise<SonosZone[]> {
  try {
    const res = await sonosFetch("/zones");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function play(): Promise<void> {
  const res = await sonosFetch(`/${ROOM}/play`);
  if (!res.ok) throw new Error("Sonos play failed");
}

export async function pause(): Promise<void> {
  const res = await sonosFetch(`/${ROOM}/pause`);
  if (!res.ok) throw new Error("Sonos pause failed");
}

export async function next(): Promise<void> {
  const res = await sonosFetch(`/${ROOM}/next`);
  if (!res.ok) throw new Error("Sonos next failed");
}

export async function previous(): Promise<void> {
  const res = await sonosFetch(`/${ROOM}/previous`);
  if (!res.ok) throw new Error("Sonos previous failed");
}

export async function setVolume(level: number): Promise<void> {
  const vol = Math.max(0, Math.min(100, Math.round(level)));
  const res = await sonosFetch(`/${ROOM}/volume/${vol}`);
  if (!res.ok) throw new Error("Sonos volume failed");
}

export async function setShuffle(on: boolean): Promise<void> {
  const res = await sonosFetch(`/${ROOM}/shuffle/${on ? "on" : "off"}`);
  if (!res.ok) throw new Error("Sonos shuffle failed");
}

export async function playSpotifyUri(uri: string): Promise<void> {
  // node-sonos-http-api accepts spotify URIs directly
  // e.g. /{room}/spotify/now/spotify:user:spotify:playlist:{id}
  // For playlists: spotify:playlist:xxx -> spotify:user:spotify:playlist:xxx
  const sonosUri = uri.startsWith("spotify:playlist:")
    ? `spotify:user:spotify:playlist:${uri.split(":")[2]}`
    : uri;

  const res = await sonosFetch(`/${ROOM}/spotify/now/${sonosUri}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sonos spotify play failed: ${text || res.status}`);
  }
}

export function getRoomName(): string {
  return env.SONOS_ROOM ?? "";
}
