import { json, error } from "@sveltejs/kit";
import { playSpotifyUri } from "$lib/server/sonos";
import { startPlayback } from "$lib/server/spotify";
import { getAccessToken } from "$lib/server/tokens";
import { readConfig } from "$lib/server/config";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const { playlist_uri } = await request.json();
  if (!playlist_uri) throw error(400, "Missing playlist_uri");

  try {
    const config = await readConfig();
    if (config.playback_backend === "spotify") {
      const token = await getAccessToken();
      await startPlayback(token, playlist_uri, config.selected_device_id);
    } else {
      await playSpotifyUri(playlist_uri);
    }
  } catch (e) {
    throw error(502, (e as Error).message);
  }

  return json({ ok: true });
};
