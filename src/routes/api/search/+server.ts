import { json, error } from "@sveltejs/kit";
import { getAccessToken } from "$lib/server/tokens";
import { searchPlaylists } from "$lib/server/spotify";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get("q");
  if (!q) throw error(400, "Missing query");

  const token = await getAccessToken();
  const playlists = await searchPlaylists(token, q);
  return json({ playlists });
};
