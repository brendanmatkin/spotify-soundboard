import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from "$env/static/private";
import fs from "node:fs/promises";
import path from "node:path";

const TOKEN_FILE = path.join(process.cwd(), "data", "tokens.json");

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

let tokens: TokenData | null = null;

async function ensureDataDir() {
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
}

async function loadFromDisk(): Promise<TokenData | null> {
  try {
    const data = await fs.readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveToDisk(data: TokenData) {
  await ensureDataDir();
  await fs.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2));
}

export async function initTokens() {
  if (!tokens) {
    tokens = await loadFromDisk();
  }
}

export function hasTokens(): boolean {
  return tokens !== null;
}

export async function setTokens(access_token: string, refresh_token: string, expires_in: number) {
  tokens = {
    access_token,
    refresh_token,
    expires_at: Date.now() + expires_in * 1000 - 60_000, // refresh 1 min early
  };
  await saveToDisk(tokens);
}

export async function getAccessToken(): Promise<string> {
  if (!tokens) throw new Error("Not authenticated");

  if (Date.now() >= tokens.expires_at) {
    await refreshAccessToken();
  }

  return tokens.access_token;
}

async function refreshAccessToken() {
  if (!tokens) throw new Error("Not authenticated");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!res.ok) {
    tokens = null;
    try {
      await fs.unlink(TOKEN_FILE);
    } catch {
      /* ignore */
    }
    throw new Error("Token refresh failed");
  }

  const data = await res.json();
  tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
  };
  await saveToDisk(tokens);
}

export async function clearTokens() {
  tokens = null;
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    /* ignore */
  }
}
