import { json, error } from "@sveltejs/kit";
import { getAccessToken } from "$lib/server/tokens";
import {
  pause,
  resume,
  skipNext,
  skipPrev,
  setShuffle,
  setVolume,
  getPlayerState,
} from "$lib/server/spotify";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const token = await getAccessToken();
  const state = await getPlayerState(token);
  return json(state);
};

export const POST: RequestHandler = async ({ request }) => {
  const { action, value } = await request.json();
  const token = await getAccessToken();

  try {
    switch (action) {
      case "pause":
        await pause(token);
        break;
      case "resume":
        await resume(token);
        break;
      case "next":
        await skipNext(token);
        break;
      case "prev":
        await skipPrev(token);
        break;
      case "shuffle":
        await setShuffle(token, value);
        break;
      case "volume":
        await setVolume(token, value);
        break;
      default:
        throw error(400, `Unknown action: ${action}`);
    }
  } catch (e) {
    throw error(502, (e as Error).message);
  }

  return json({ ok: true });
};
