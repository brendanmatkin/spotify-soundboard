import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { initTokens, hasTokens } from '$lib/server/tokens';

let initialized = false;

export const handle: Handle = async ({ event, resolve }) => {
	if (!initialized) {
		await initTokens();
		initialized = true;
	}

	if (event.url.pathname.startsWith('/auth')) {
		return resolve(event);
	}

	if (!hasTokens()) {
		throw redirect(302, '/auth/login');
	}

	return resolve(event);
};
