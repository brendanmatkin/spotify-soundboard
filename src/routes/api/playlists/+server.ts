import { json } from "@sveltejs/kit";
import { getAccessToken } from "$lib/server/tokens";
import { getAllUserPlaylists } from "$lib/server/spotify";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const token = await getAccessToken();
  const playlists = await getAllUserPlaylists(token);
  return json({ playlists });
};
