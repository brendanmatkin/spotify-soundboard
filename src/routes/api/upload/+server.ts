import { json, error } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { RequestHandler } from './$types';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!(file instanceof File)) throw error(400, 'No file provided');
		if (file.size > MAX_SIZE) throw error(400, `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB, max 10MB)`);
		if (file.type && !ALLOWED_TYPES.includes(file.type)) {
			throw error(400, `Unsupported file type: ${file.type}`);
		}

		const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
		const filename = `${crypto.randomUUID()}.${ext}`;

		await fs.mkdir(IMAGES_DIR, { recursive: true });
		const buffer = Buffer.from(await file.arrayBuffer());
		await fs.writeFile(path.join(IMAGES_DIR, filename), buffer);

		return json({ url: `/api/upload/${filename}` });
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e; // re-throw SvelteKit errors
		const msg = e instanceof Error ? e.message : 'Upload failed';
		throw error(500, msg);
	}
};
