import { error } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');

const MIME: Record<string, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif'
};

export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename;
	// Sanitize: only allow alphanumeric, hyphens, dots
	if (!/^[a-zA-Z0-9\-]+\.[a-z]+$/.test(filename)) throw error(400, 'Invalid filename');

	const filepath = path.join(IMAGES_DIR, filename);
	try {
		const data = await fs.readFile(filepath);
		const ext = filename.split('.').pop() ?? '';
		return new Response(data, {
			headers: {
				'Content-Type': MIME[ext] ?? 'application/octet-stream',
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		throw error(404, 'Not found');
	}
};
