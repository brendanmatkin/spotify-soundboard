import { json, error } from '@sveltejs/kit';
import { getAccessToken } from '$lib/server/tokens';
import { getDevices } from '$lib/server/spotify';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const token = await getAccessToken();
	try {
		const devices = await getDevices(token);
		return json({ devices });
	} catch (e) {
		throw error(502, (e as Error).message);
	}
};
