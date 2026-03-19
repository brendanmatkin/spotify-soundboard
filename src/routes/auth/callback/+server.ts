import { redirect, error } from '@sveltejs/kit';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, ORIGIN } from '$env/static/private';
import { setTokens } from '$lib/server/tokens';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	const err = url.searchParams.get('error');

	if (err) throw error(400, `Spotify auth error: ${err}`);
	if (!code) throw error(400, 'Missing authorization code');

	const redirectUri = `${ORIGIN}/auth/callback`;

	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw error(500, `Token exchange failed: ${body}`);
	}

	const data = await res.json();
	await setTokens(data.access_token, data.refresh_token, data.expires_in);

	throw redirect(302, '/');
};
