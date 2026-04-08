import { json, error } from "@sveltejs/kit";
import { getZones, getRoomName } from "$lib/server/sonos";
import { getDevices as getSpotifyDevices, transferPlayback } from "$lib/server/spotify";
import { getAccessToken } from "$lib/server/tokens";
import { readConfig } from "$lib/server/config";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  try {
    const config = await readConfig();
    let devices: Array<{ id: string; name: string; type: string; is_active: boolean }> = [];

    if (config.playback_backend === "spotify") {
      const token = await getAccessToken();
      devices = await getSpotifyDevices(token);
    } else {
      const zones = await getZones();
      const currentRoom = getRoomName();
      devices = zones.flatMap((z) =>
        z.members.map((m) => ({
          id: m.uuid,
          name: m.roomName,
          type: "Sonos",
          is_active: m.roomName.toLowerCase() === currentRoom.toLowerCase(),
        })),
      );
    }

    return json({ devices });
  } catch (e) {
    throw error(502, (e as Error).message);
  }
};

// Transfer Spotify playback to a newly selected device
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { deviceId } = await request.json();
    if (!deviceId) throw error(400, "Missing deviceId");
    const config = await readConfig();
    if (config.playback_backend !== "spotify") return json({ ok: true });
    const token = await getAccessToken();
    await transferPlayback(token, deviceId);
    return json({ ok: true });
  } catch (e) {
    throw error(502, (e as Error).message);
  }
};
