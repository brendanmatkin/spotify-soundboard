<script lang="ts">
	import { getContext, untrack, onMount } from 'svelte';
	import type { ButtonConfig } from '$lib/types';

	let { data } = $props();

	const editCtx = getContext<{ readonly value: boolean; toggle: () => void }>('editMode');

	let buttons = $state<ButtonConfig[]>(untrack(() => data.buttons.filter((b) => b.playlist_uri)));
	let selectedDeviceId = $state<string | null>(untrack(() => data.selectedDeviceId));

	// Error toast
	let errorMsg = $state<string | null>(null);
	let errorTimeout: ReturnType<typeof setTimeout> | undefined;

	function showError(msg: string) {
		errorMsg = msg;
		clearTimeout(errorTimeout);
		errorTimeout = setTimeout(() => (errorMsg = null), 3000);
	}

	// Player controls
	let isPlaying = $state(false);
	let shuffleOn = $state(false);
	let nowPlayingTrack = $state<string | null>(null);
	let nowPlayingArtist = $state<string | null>(null);
	let nowPlayingContextUri = $state<string | null>(null);
	let volume = $state(50);
	let progressMs = $state(0);
	let durationMs = $state(0);
	let progressUpdatedAt = $state(0);
	let displayProgress = $state(0);

	async function fetchPlayerState() {
		try {
			const res = await fetch('/api/player');
			if (!res.ok) return;
			const state = await res.json();
			if (state) {
				isPlaying = state.is_playing ?? false;
				shuffleOn = state.shuffle_state ?? false;
				nowPlayingTrack = state.item?.name ?? null;
				nowPlayingArtist =
					state.item?.artists?.map((a: { name: string }) => a.name).join(', ') ?? null;
				nowPlayingContextUri = state.context?.uri ?? null;
				volume = state.device?.volume_percent ?? volume;
				progressMs = state.progress_ms ?? 0;
				durationMs = state.item?.duration_ms ?? 0;
				progressUpdatedAt = Date.now();
			}
		} catch {
			/* ignore */
		}
	}

	let volumeTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleVolumeInput(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		volume = val;
		clearTimeout(volumeTimeout);
		volumeTimeout = setTimeout(() => playerAction('volume', val), 150);
	}

	async function playerAction(action: string, value?: boolean | number) {
		// For pause/resume, refresh state first to avoid stale toggle
		if (action === 'pause' || action === 'resume') {
			await fetchPlayerState();
			action = isPlaying ? 'pause' : 'resume';
		}
		try {
			const res = await fetch('/api/player', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, value })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				showError(d.message ?? `${action} failed`);
			}
			setTimeout(fetchPlayerState, 300);
		} catch {
			showError('Network error');
		}
	}

	onMount(() => {
		fetchPlayerState();

		// Smooth progress bar interpolation
		let raf: number;
		function tickProgress() {
			if (isPlaying && durationMs > 0) {
				const elapsed = Date.now() - progressUpdatedAt;
				displayProgress = Math.min((progressMs + elapsed) / durationMs, 1);
			} else if (durationMs > 0) {
				displayProgress = progressMs / durationMs;
			} else {
				displayProgress = 0;
			}
			raf = requestAnimationFrame(tickProgress);
		}
		raf = requestAnimationFrame(tickProgress);
		// Poll at 10s, only when tab is visible
		let interval = setInterval(() => { fetchPlayerState(); refreshConfig(); }, 5000);
		function onVisibility() {
			clearInterval(interval);
			if (!document.hidden) {
				fetchPlayerState();
				refreshConfig();
				interval = setInterval(fetchPlayerState, 10000);
			}
		}
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			clearInterval(interval);
			cancelAnimationFrame(raf);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});

	// Sync config when tab becomes visible (e.g. edited on another device)
	async function refreshConfig() {
		try {
			const res = await fetch('/api/config');
			if (!res.ok) return;
			const config = await res.json();
			const fresh = (config.buttons ?? []).filter((b: ButtonConfig) => b.playlist_uri);
			// Only update if different to avoid disrupting local state
			if (JSON.stringify($state.snapshot(buttons)) !== JSON.stringify(fresh)) {
				buttons = fresh;
				selectedDeviceId = config.selected_device_id ?? selectedDeviceId;
			}
		} catch { /* ignore */ }
	}

	// Preload library when entering edit mode
	$effect(() => {
		if (editCtx.value) loadLibrary();
	});

	// Play mode
	let playingId = $state<string | null>(null);

	async function play(btn: ButtonConfig) {
		if (!btn.playlist_uri) return;
		playingId = btn.id;
		setTimeout(() => (playingId = null), 400);

		try {
			const res = await fetch('/api/play', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					playlist_uri: btn.playlist_uri,
					device_id: selectedDeviceId
				})
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({ message: 'Playback failed' }));
				showError(d.message ?? 'Playback failed');
			}
			setTimeout(fetchPlayerState, 500);
		} catch {
			showError('Network error');
		}
	}

	// Derived: only populated buttons for play mode
	let populatedButtons = $derived(buttons.filter((b) => b.playlist_uri));

	let visibleCount = $derived(editCtx.value ? buttons.length + 1 : populatedButtons.length);

	// Edit mode
	let editingIndex = $state<number | null>(null); // index in buttons array, or -1 for "add new"
	let pickerTab = $state<'paste' | 'search' | 'library'>('paste');
	let pasteInput = $state('');
	let searchQuery = $state('');
	let searchResults = $state<Array<{ uri: string; name: string; image_url: string | null }>>([]);
	let libraryPlaylists = $state<Array<{ uri: string; name: string; image_url: string | null }>>([]);
	let libraryLoaded = $state(false);
	let loading = $state(false);

	// Library filter
	let libraryFilter = $state('');
	let filteredLibrary = $derived(
		libraryFilter
			? libraryPlaylists.filter((p) =>
					p.name.toLowerCase().includes(libraryFilter.toLowerCase())
				)
			: libraryPlaylists
	);

	function openPicker(index: number) {
		editingIndex = index;
		pickerTab = 'library';
		pasteInput = '';
		searchQuery = '';
		searchResults = [];
		libraryFilter = '';
		loadLibrary();
	}

	function openAddNew() {
		editingIndex = -1;
		pickerTab = 'library';
		pasteInput = '';
		searchQuery = '';
		searchResults = [];
		libraryFilter = '';
		loadLibrary();
	}

	function closePicker() {
		editingIndex = null;
	}

	let saveTimeout: ReturnType<typeof setTimeout> | undefined;

	function saveConfig() {
		// Debounce saves to avoid races, and ensure we capture latest state
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(async () => {
			try {
				await fetch('/api/config', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						buttons: $state.snapshot(buttons),
						grid_size: buttons.length,
						selected_device_id: selectedDeviceId
					})
				});
			} catch {
				showError('Failed to save config');
			}
		}, 100);
	}

	async function assignPlaylist(uri: string, name: string, image_url: string | null) {
		if (editingIndex === null) return;
		if (editingIndex === -1) {
			// Add new button
			const nextPos = buttons.length > 0 ? Math.max(...buttons.map((b) => b.position)) + 1 : 0;
			buttons.push({
				id: `btn-${nextPos}`,
				position: nextPos,
				playlist_uri: uri,
				name,
				image_url
			});
		} else {
			buttons[editingIndex] = { ...buttons[editingIndex], playlist_uri: uri, name, image_url };
		}
		closePicker();
		saveConfig();
	}

	async function uploadImage(index: number, file: File) {
		const formData = new FormData();
		formData.append('file', file);
		const res = await fetch('/api/upload', { method: 'POST', body: formData });
		if (!res.ok) {
			const err = await res.json().catch(() => ({ message: 'Image upload failed' }));
			showError(err.message ?? 'Image upload failed');
			return;
		}
		const { url } = await res.json();
		const idx = index === -1 ? buttons.length - 1 : index;
		if (idx >= 0 && idx < buttons.length) {
			buttons[idx] = { ...buttons[idx], custom_image_url: url };
			saveConfig();
		}
	}

	async function clearCustomImage() {
		if (editingIndex === null || editingIndex < 0) return;
		buttons[editingIndex] = { ...buttons[editingIndex], custom_image_url: null };
		saveConfig();
	}

	async function clearButton() {
		if (editingIndex === null || editingIndex === -1) return;
		buttons.splice(editingIndex, 1);
		closePicker();
		saveConfig();
	}

	async function pasteAdd() {
		if (!pasteInput.trim()) return;
		loading = true;
		try {
			const res = await fetch(
				`/api/playlist-details?uri=${encodeURIComponent(pasteInput.trim())}`
			);
			if (!res.ok) {
				loading = false;
				return;
			}
			const pl = await res.json();
			await assignPlaylist(pl.uri, pl.name, pl.image_url);
		} finally {
			loading = false;
		}
	}

	async function doSearch() {
		if (!searchQuery.trim()) return;
		loading = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
			const json = await res.json();
			searchResults = json.playlists ?? [];
		} finally {
			loading = false;
		}
	}

	async function loadLibrary() {
		if (libraryLoaded) return;
		loading = true;
		try {
			const res = await fetch('/api/playlists');
			const json = await res.json();
			libraryPlaylists = json.playlists ?? [];
			libraryLoaded = true;
		} finally {
			loading = false;
		}
	}

	// Device selector
	let showDevices = $state(false);
	let devices = $state<Array<{ id: string; name: string; type: string; is_active: boolean }>>([]);

	async function loadDevices() {
		const res = await fetch('/api/devices');
		const json = await res.json();
		devices = json.devices ?? [];
		showDevices = true;
	}

	async function selectDevice(id: string | null) {
		selectedDeviceId = id;
		showDevices = false;
		saveConfig();
	}

	let selectedDeviceName = $derived(
		devices.find((d) => d.id === selectedDeviceId)?.name ?? 'Auto'
	);
</script>

{#if errorMsg}
	<div class="toast">{errorMsg}</div>
{/if}

<div class="grid">
	{#if editCtx.value}
		{#each buttons as btn, i (btn.id)}
			<button
				class="cell edit-mode"
				class:has-playlist={btn.playlist_uri}
				onclick={() => openPicker(i)}
			>
				{#if btn.custom_image_url || btn.image_url}
					<img src={btn.custom_image_url ?? btn.image_url} alt="" loading="lazy" class="artwork" />
				{/if}
				{#if btn.playlist_uri}
					<span class="label">{btn.name ?? 'Playlist'}</span>
				{:else}
					<span class="plus">+</span>
				{/if}
				<span class="edit-badge">&#x270E;</span>
			</button>
		{/each}
		<button class="cell add-btn" onclick={openAddNew}>
			<span class="plus">+</span>
		</button>
	{:else}
		{#each populatedButtons as btn (btn.id)}
			<button
				class="cell has-playlist"
				class:playing={playingId === btn.id}
				class:active-playlist={isPlaying && nowPlayingContextUri === btn.playlist_uri}
				onclick={() => play(btn)}
			>
				{#if btn.custom_image_url || btn.image_url}
					<img src={btn.custom_image_url ?? btn.image_url} alt="" loading="lazy" class="artwork" />
				{/if}
				<span class="label">{btn.name ?? 'Playlist'}</span>
			</button>
		{/each}
		{#if populatedButtons.length === 0}
			<div class="empty-state">Tap Edit to add playlists</div>
		{/if}
	{/if}
</div>

<div class="bottom-bar">
	<div class="progress-bar" style:--progress="{displayProgress * 100}%"></div>

	<div class="bar-row-1">
		<div class="controls">
			<button class="ctrl-btn" class:active={shuffleOn} onclick={() => playerAction('shuffle', !shuffleOn)} title="Shuffle">&#x21C4;</button>
			<button class="ctrl-btn" onclick={() => playerAction('prev')} title="Previous">&#x23EE;</button>
			<button class="ctrl-btn play-pause" onclick={() => playerAction(isPlaying ? 'pause' : 'resume')} title={isPlaying ? 'Pause' : 'Play'}>
				{#if isPlaying}<span class="pause-icon"></span>{:else}&#x25B6;{/if}
			</button>
			<button class="ctrl-btn" onclick={() => playerAction('next')} title="Next">&#x23ED;</button>
		</div>
		<input
			type="range"
			class="vol-slider vol-mobile"
			min="0"
			max="100"
			value={volume}
			oninput={(e) => handleVolumeInput(e)}
			style:--fill="{volume}%"
		/>
		<span class="vol-pct vol-mobile">{volume}</span>
	</div>

	<div class="bar-row-2">
		<button class="device-btn" onclick={loadDevices}>
			&#x266A; {selectedDeviceName}
		</button>

		<div class="controls desktop-only">
			<button class="ctrl-btn" class:active={shuffleOn} onclick={() => playerAction('shuffle', !shuffleOn)} title="Shuffle">&#x21C4;</button>
			<button class="ctrl-btn" onclick={() => playerAction('prev')} title="Previous">&#x23EE;</button>
			<button class="ctrl-btn play-pause" onclick={() => playerAction(isPlaying ? 'pause' : 'resume')} title={isPlaying ? 'Pause' : 'Play'}>
				{#if isPlaying}<span class="pause-icon"></span>{:else}&#x25B6;{/if}
			</button>
			<button class="ctrl-btn" onclick={() => playerAction('next')} title="Next">&#x23ED;</button>
			<input
				type="range"
				class="vol-slider vol-desktop"
				min="0"
				max="100"
				value={volume}
				oninput={(e) => handleVolumeInput(e)}
				style:--fill="{volume}%"
			/>
		</div>

		<div class="now-playing">
			{#if nowPlayingTrack}
				<span class="track-name">{nowPlayingTrack}</span>
				{#if nowPlayingArtist}<span class="track-artist">&middot; {nowPlayingArtist}</span>{/if}
			{:else}
				<span class="track-name dimmed">Not playing</span>
			{/if}
		</div>
	</div>
	{#if showDevices}
		<div class="device-dropdown">
			<button class="device-option" onclick={() => selectDevice(null)}>
				Auto (active device)
			</button>
			{#each devices as device (device.id)}
				<button
					class="device-option"
					class:active={selectedDeviceId === device.id}
					onclick={() => selectDevice(device.id)}
				>
					{device.name} ({device.type})
					{#if device.is_active}<span class="active-dot"></span>{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if editingIndex !== null}
	<div class="modal-overlay" onclick={closePicker} role="presentation">
		<div
			class="modal"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.key === 'Escape' && closePicker()}
			role="dialog"
			tabindex="-1"
		>
			<div class="modal-header">
				<h2>Choose Playlist</h2>
				<button class="close-btn" onclick={closePicker}>&#x2715;</button>
			</div>

			<div class="tabs">
				<button class:active={pickerTab === 'paste'} onclick={() => (pickerTab = 'paste')}
					>Paste URL</button
				>
				<button class:active={pickerTab === 'search'} onclick={() => (pickerTab = 'search')}
					>Search</button
				>
				<button
					class:active={pickerTab === 'library'}
					onclick={() => {
						pickerTab = 'library';
						loadLibrary();
					}}>My Playlists</button
				>
			</div>

			<div class="modal-body">
				{#if pickerTab === 'paste'}
					<div class="paste-form">
						<input
							type="text"
							placeholder="Spotify playlist URL or URI"
							bind:value={pasteInput}
							onkeydown={(e) => e.key === 'Enter' && pasteAdd()}
						/>
						<button onclick={pasteAdd} disabled={loading}>
							{loading ? '...' : 'Add'}
						</button>
					</div>
				{:else if pickerTab === 'search'}
					<div class="search-form">
						<input
							type="text"
							placeholder="Search playlists..."
							bind:value={searchQuery}
							onkeydown={(e) => e.key === 'Enter' && doSearch()}
						/>
						<button onclick={doSearch} disabled={loading}>
							{loading ? '...' : 'Search'}
						</button>
					</div>
					<div class="results">
						{#each searchResults as pl, i (i)}
							<button
								class="result-item"
								onclick={() => assignPlaylist(pl.uri, pl.name, pl.image_url)}
							>
								{#if pl.image_url}
									<img src={pl.image_url} alt="" class="result-img" />
								{:else}
									<div class="result-img placeholder"></div>
								{/if}
								<span>{pl.name}</span>
							</button>
						{/each}
					</div>
				{:else}
					<div class="filter-form">
						<input
							type="text"
							placeholder="Filter playlists..."
							bind:value={libraryFilter}
						/>
					</div>
					{#if loading}
						<p class="loading-text">Loading...</p>
					{/if}
					<div class="results">
						{#each filteredLibrary as pl, i (i)}
							<button
								class="result-item"
								onclick={() => assignPlaylist(pl.uri, pl.name, pl.image_url)}
							>
								{#if pl.image_url}
									<img src={pl.image_url} alt="" class="result-img" />
								{:else}
									<div class="result-img placeholder"></div>
								{/if}
								<span>{pl.name}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<label class="upload-btn">
					Custom Image
					<input
						type="file"
						accept="image/*"
						onchange={(e) => {
							const file = (e.target as HTMLInputElement).files?.[0];
							if (file && editingIndex !== null) uploadImage(editingIndex, file);
						}}
					/>
				</label>
				{#if editingIndex !== null && editingIndex >= 0 && buttons[editingIndex]?.custom_image_url}
					<button class="text-btn" onclick={clearCustomImage}>Reset Image</button>
				{/if}
				{#if editingIndex !== null && editingIndex >= 0 && buttons[editingIndex]?.playlist_uri}
					<button class="clear-btn" onclick={clearButton}>Remove</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.grid {
		display: flex;
		flex-wrap: wrap;
		align-content: start;
		gap: 8px;
		padding: 8px;
		padding-bottom: 90px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.cell {
		position: relative;
		background: var(--surface);
		border-radius: var(--radius);
		container-type: inline-size;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: manipulation;
		transition: transform 0.15s ease, box-shadow 0.2s ease;
		width: calc(33.333% - 6px);
		aspect-ratio: 1;
		flex-shrink: 0;
	}

	@media (min-width: 768px) {
		.cell {
			width: 20vmin;
			max-width: 40vmin;
			flex-grow: 1;
		}
	}

	.cell:active {
		transform: scale(0.95);
	}

	.cell.active-playlist {
		box-shadow: 0 0 0 3px var(--accent), 0 0 12px rgba(29, 185, 84, 0.3);
	}

	.cell.playing {
		animation: pulse 0.4s ease;
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(29, 185, 84, 0.6);
		}
		70% {
			box-shadow: 0 0 0 12px rgba(29, 185, 84, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(29, 185, 84, 0);
		}
	}

	.artwork {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 10px;
		background: rgba(0, 0, 0, 0.45);
		font-size: clamp(0.85rem, 4cqi, 1.5rem);
		font-weight: 600;
		text-align: center;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
		line-height: 1.2;
		overflow-wrap: break-word;
		word-break: break-word;
	}

	.plus {
		font-size: 2rem;
		color: var(--text-dim);
	}

	.add-btn {
		border: 2px dashed var(--text-dim);
		background: transparent;
	}

	.empty-state {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-dim);
		font-size: 1rem;
		padding: 40px;
	}

	.edit-badge {
		position: absolute;
		top: 6px;
		right: 6px;
		background: rgba(0, 0, 0, 0.7);
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
	}

	.edit-mode {
		outline: 2px dashed var(--accent);
		outline-offset: -2px;
	}

	/* Error toast */
	.toast {
		position: fixed;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--danger);
		color: white;
		padding: 10px 20px;
		border-radius: 8px;
		font-size: 0.85rem;
		z-index: 200;
		animation: toast-in 0.2s ease;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* Bottom bar: device + controls + now playing */
	.bottom-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border-top: 1px solid var(--surface-hover);
		z-index: 50;
	}

	.progress-bar {
		height: 3px;
		background: linear-gradient(to right, var(--text-dim) var(--progress, 0%), transparent var(--progress, 0%));
		margin-bottom: 2px;
	}

	.bar-row-1 {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 4px 12px 2px;
	}

	.bar-row-2 {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 2px 12px 6px;
	}

	.controls.desktop-only {
		display: none;
	}

	.vol-pct {
		font-size: 0.7rem;
		color: var(--text-dim);
		width: 24px;
		text-align: right;
		flex-shrink: 0;
	}

	.vol-desktop {
		width: 80px;
		height: 4px;
		margin-left: 12px;
	}

	.vol-desktop::-webkit-slider-thumb {
		width: 14px;
		height: 14px;
	}

	.vol-desktop::-moz-range-thumb {
		width: 14px;
		height: 14px;
	}

	@media (min-width: 768px) {
		.bar-row-1 {
			display: none;
		}
		.bar-row-2 {
			display: grid;
			grid-template-columns: 1fr auto 1fr;
			padding: 6px 12px;
		}
		.controls.desktop-only {
			display: flex;
		}
	}

	.device-btn {
		background: var(--surface-hover);
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 0.7rem;
		color: var(--text-dim);
		white-space: nowrap;
		width: fit-content;
		justify-self: start;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.ctrl-btn {
		background: none;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.95rem;
		color: var(--text-dim);
		touch-action: manipulation;
	}

	.ctrl-btn:active {
		background: var(--surface-hover);
	}

	.ctrl-btn.active {
		color: var(--accent);
	}

	.ctrl-btn.play-pause {
		width: 36px;
		height: 36px;
		background: var(--text);
		color: var(--bg);
		font-size: 1rem;
	}

	.pause-icon {
		display: flex;
		gap: 3px;
	}

	.pause-icon::before,
	.pause-icon::after {
		content: '';
		width: 4px;
		height: 14px;
		background: currentColor;
		border-radius: 1px;
	}

	.ctrl-btn.play-pause:active {
		background: var(--text-dim);
	}

	.vol-slider {
		flex: 1;
		height: 6px;
		-webkit-appearance: none;
		appearance: none;
		background: linear-gradient(to right, var(--text-dim) var(--fill, 0%), var(--surface-hover) var(--fill, 0%));
		border-radius: 3px;
		outline: none;
		touch-action: manipulation;
	}

	.vol-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--text);
		cursor: pointer;
	}

	.vol-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--text);
		border: none;
		cursor: pointer;
	}

	.vol-slider::-moz-range-progress {
		background: var(--text-dim);
		border-radius: 3px;
		height: 6px;
	}

	.now-playing {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 4px;
		justify-content: flex-end;
	}

	.track-name {
		font-size: 0.75rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-name.dimmed {
		color: var(--text-dim);
	}

	.track-artist {
		font-size: 0.7rem;
		color: var(--text-dim);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.device-dropdown {
		position: absolute;
		bottom: 100%;
		left: 12px;
		background: var(--surface);
		border-radius: var(--radius);
		padding: 4px;
		min-width: 220px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
		z-index: 10;
	}

	.device-option {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		background: none;
		border-radius: 8px;
		font-size: 0.85rem;
		text-align: left;
	}

	.device-option:hover,
	.device-option.active {
		background: var(--surface-hover);
	}

	.active-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 16px;
	}

	.modal {
		background: var(--surface);
		border-radius: var(--radius);
		width: 100%;
		max-width: 480px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
	}

	.modal-header h2 {
		font-size: 1.1rem;
	}

	.close-btn {
		background: none;
		font-size: 1.2rem;
		padding: 4px 8px;
	}

	.tabs {
		display: flex;
		gap: 4px;
		padding: 0 12px;
	}

	.tabs button {
		flex: 1;
		padding: 8px;
		background: none;
		border-radius: 8px;
		font-size: 0.85rem;
		color: var(--text-dim);
	}

	.tabs button.active {
		background: var(--surface-hover);
		color: var(--text);
	}

	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 12px 16px;
	}

	.paste-form,
	.search-form {
		display: flex;
		gap: 8px;
	}

	.paste-form input,
	.search-form input {
		flex: 1;
		background: var(--bg);
		border: 1px solid var(--surface-hover);
		padding: 10px 12px;
		border-radius: 8px;
		font-size: 0.9rem;
	}

	.paste-form button,
	.search-form button {
		background: var(--accent);
		padding: 10px 16px;
		border-radius: 8px;
		font-weight: 500;
		font-size: 0.9rem;
	}

	.paste-form button:disabled,
	.search-form button:disabled {
		opacity: 0.5;
	}

	/* Filter input in library */
	.filter-form {
		margin-bottom: 8px;
	}

	.filter-form input {
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--surface-hover);
		padding: 10px 12px;
		border-radius: 8px;
		font-size: 0.9rem;
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 12px;
	}

	.result-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px;
		background: none;
		border-radius: 8px;
		text-align: left;
	}

	.result-item:hover {
		background: var(--surface-hover);
	}

	.result-img {
		width: 48px;
		height: 48px;
		border-radius: 4px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.result-img.placeholder {
		background: var(--surface-hover);
	}

	.loading-text {
		color: var(--text-dim);
		text-align: center;
		padding: 20px;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid var(--surface-hover);
	}

	.upload-btn {
		padding: 8px 14px;
		background: var(--surface-hover);
		border-radius: 8px;
		font-size: 0.85rem;
		cursor: pointer;
		touch-action: manipulation;
	}

	.upload-btn input {
		display: none;
	}

	.text-btn {
		padding: 8px 14px;
		background: none;
		font-size: 0.85rem;
		color: var(--text-dim);
	}

	.clear-btn {
		margin-left: auto;
		padding: 8px 14px;
		background: var(--danger);
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 500;
	}
</style>
