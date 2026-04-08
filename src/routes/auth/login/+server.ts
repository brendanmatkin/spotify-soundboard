import { redirect } from "@sveltejs/kit";
import { SPOTIFY_CLIENT_ID, ORIGIN } from "$env/static/private";
import type { RequestHandler } from "./$types";

const SCOPES = "user-modify-playback-state user-read-playback-state playlist-read-private";

export const GET: RequestHandler = () => {
  const state = crypto.randomUUID();
  const redirectUri = `${ORIGIN}/auth/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  throw redirect(302, `https://accounts.spotify.com/authorize?${params}`);
};
