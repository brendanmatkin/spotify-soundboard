import { json, error } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { RequestHandler } from './$types';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File)) throw error(400, 'No file provided');
	if (!ALLOWED_TYPES.includes(file.type)) throw error(400, 'Invalid file type');
	if (file.size > MAX_SIZE) throw error(400, 'File too large (max 5MB)');

	const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
	const filename = `${crypto.randomUUID()}.${ext}`;

	await fs.mkdir(IMAGES_DIR, { recursive: true });
	const buffer = Buffer.from(await file.arrayBuffer());
	await fs.writeFile(path.join(IMAGES_DIR, filename), buffer);

	return json({ url: `/api/upload/${filename}` });
};
