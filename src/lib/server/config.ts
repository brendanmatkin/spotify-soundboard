import type { AppConfig, ButtonConfig } from '$lib/types';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'config.json');

function makeDefaultConfig(gridSize = 12): AppConfig {
	const buttons: ButtonConfig[] = [];
	for (let i = 0; i < gridSize; i++) {
		buttons.push({
			id: `btn-${i}`,
			position: i,
			playlist_uri: null,
			name: null,
			image_url: null
		});
	}
	return { buttons, grid_size: gridSize, selected_device_id: null };
}

export async function readConfig(): Promise<AppConfig> {
	try {
		const data = await fs.readFile(CONFIG_FILE, 'utf-8');
		return JSON.parse(data);
	} catch {
		return makeDefaultConfig();
	}
}

export async function writeConfig(config: AppConfig): Promise<void> {
	await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
	const tmp = CONFIG_FILE + '.tmp';
	await fs.writeFile(tmp, JSON.stringify(config, null, 2));
	await fs.rename(tmp, CONFIG_FILE);
}
