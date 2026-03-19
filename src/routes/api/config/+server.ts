import { json, error } from '@sveltejs/kit';
import { readConfig, writeConfig } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const config = await readConfig();
	return json(config);
};

export const PUT: RequestHandler = async ({ request }) => {
	const config = await request.json();
	if (!config?.buttons || !Array.isArray(config.buttons)) {
		throw error(400, 'Invalid config');
	}
	await writeConfig(config);
	return json(config);
};
