import { json, error } from "@sveltejs/kit";
import { getAccessToken } from "$lib/server/tokens";
import { getPlaylistDetails, parsePlaylistId } from "$lib/server/spotify";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const input = url.searchParams.get("uri");
  if (!input) throw error(400, "Missing uri");

  const playlistId = parsePlaylistId(input);
  if (!playlistId) throw error(400, "Invalid playlist URI or URL");

  const token = await getAccessToken();
  try {
    const playlist = await getPlaylistDetails(token, playlistId);
    return json(playlist);
  } catch (e) {
    throw error(502, (e as Error).message);
  }
};
