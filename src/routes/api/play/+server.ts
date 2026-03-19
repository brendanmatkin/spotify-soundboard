import { json, error } from '@sveltejs/kit';
import { getAccessToken } from '$lib/server/tokens';
import { startPlayback } from '$lib/server/spotify';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { playlist_uri, device_id } = await request.json();
	if (!playlist_uri) throw error(400, 'Missing playlist_uri');

	const token = await getAccessToken();
	try {
		await startPlayback(token, playlist_uri, device_id);
	} catch (e) {
		throw error(502, (e as Error).message);
	}

	return json({ ok: true });
};
