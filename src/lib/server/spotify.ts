import type { PlaylistSummary, SpotifyDevice } from '$lib/types';

const API = 'https://api.spotify.com/v1';

let rateLimitUntil = 0;

async function apiFetch(token: string, url: string, init?: RequestInit): Promise<Response> {
	const now = Date.now();
	if (now < rateLimitUntil) {
		return new Response(JSON.stringify({ error: { message: 'Rate limited, waiting' } }), {
			status: 429
		});
	}

	const res = await fetch(url, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			...init?.headers
		}
	});

	if (res.status === 429) {
		const retryAfter = parseInt(res.headers.get('Retry-After') ?? '10', 10);
		rateLimitUntil = Date.now() + retryAfter * 1000;
	}

	return res;
}

export async function startPlayback(token: string, contextUri: string, deviceId?: string | null) {
	const params = deviceId ? `?device_id=${deviceId}` : '';
	const res = await apiFetch(token, `${API}/me/player/play${params}`, {
		method: 'PUT',
		body: JSON.stringify({ context_uri: contextUri })
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err?.error?.message ?? `Playback failed (${res.status})`);
	}
}

export async function getDevices(token: string): Promise<SpotifyDevice[]> {
	const res = await apiFetch(token, `${API}/me/player/devices`);
	if (!res.ok) throw new Error('Failed to fetch devices');
	const data = await res.json();
	return data.devices.map((d: Record<string, unknown>) => ({
		id: d.id as string,
		name: d.name as string,
		type: d.type as string,
		is_active: d.is_active as boolean
	}));
}

export async function searchPlaylists(token: string, query: string): Promise<PlaylistSummary[]> {
	const res = await apiFetch(token, `${API}/search?q=${encodeURIComponent(query)}&type=playlist&limit=12`);
	if (!res.ok) throw new Error('Search failed');
	const data = await res.json();
	return (data.playlists?.items ?? [])
		.filter((p: Record<string, unknown>) => p !== null)
		.map(mapPlaylist);
}

export async function getUserPlaylists(token: string): Promise<PlaylistSummary[]> {
	const res = await apiFetch(token, `${API}/me/playlists?limit=50`);
	if (!res.ok) throw new Error('Failed to fetch playlists');
	const data = await res.json();
	return (data.items ?? []).map(mapPlaylist);
}

export async function getPlaylistDetails(token: string, playlistId: string): Promise<PlaylistSummary> {
	const res = await apiFetch(token, `${API}/playlists/${playlistId}?fields=uri,name,images`);
	if (!res.ok) throw new Error('Failed to fetch playlist');
	const data = await res.json();
	return mapPlaylist(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlaylist(p: any): PlaylistSummary {
	return {
		uri: p.uri,
		name: p.name,
		image_url: p.images?.[0]?.url ?? null
	};
}

export async function resume(token: string) {
	const res = await apiFetch(token, `${API}/me/player/play`, { method: 'PUT' });
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err?.error?.message ?? `Resume failed (${res.status})`);
	}
}

export async function pause(token: string) {
	const res = await apiFetch(token, `${API}/me/player/pause`, { method: 'PUT' });
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err?.error?.message ?? `Pause failed (${res.status})`);
	}
}

export async function skipNext(token: string) {
	const res = await apiFetch(token, `${API}/me/player/next`, { method: 'POST' });
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err?.error?.message ?? `Skip failed (${res.status})`);
	}
}

export async function skipPrev(token: string) {
	const res = await apiFetch(token, `${API}/me/player/previous`, { method: 'POST' });
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err?.error?.message ?? `Skip failed (${res.status})`);
	}
}

export async function setShuffle(token: string, state: boolean) {
	const res = await apiFetch(token, `${API}/me/player/shuffle?state=${state}`, { method: 'PUT' });
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err?.error?.message ?? `Shuffle failed (${res.status})`);
	}
}

export async function setVolume(token: string, percent: number) {
	const vol = Math.max(0, Math.min(100, Math.round(percent)));
	const res = await apiFetch(token, `${API}/me/player/volume?volume_percent=${vol}`, { method: 'PUT' });
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err?.error?.message ?? `Volume failed (${res.status})`);
	}
}

export async function getPlayerState(token: string) {
	const res = await apiFetch(token, `${API}/me/player`);
	if (res.status === 204) return null;
	if (!res.ok) return null;
	return res.json();
}

export async function getAllUserPlaylists(token: string): Promise<PlaylistSummary[]> {
	// Spotify API doesn't expose folders, so we fetch all playlists (up to 50 per page)
	const all: PlaylistSummary[] = [];
	let url: string | null = `${API}/me/playlists?limit=50`;
	while (url) {
		const res = await apiFetch(token, url);
		if (!res.ok) break;
		const data = await res.json();
		all.push(...(data.items ?? []).map(mapPlaylist));
		url = data.next;
	}
	return all;
}

export function parsePlaylistId(input: string): string | null {
	// spotify:playlist:XXXXX
	const uriMatch = input.match(/spotify:playlist:([a-zA-Z0-9]+)/);
	if (uriMatch) return uriMatch[1];

	// https://open.spotify.com/playlist/XXXXX?si=...
	const urlMatch = input.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
	if (urlMatch) return urlMatch[1];

	return null;
}
