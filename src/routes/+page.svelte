<script lang="ts">
	import { getContext, untrack, onMount } from 'svelte';
	import type { ButtonConfig } from '$lib/types';
	import Toast from '$lib/components/Toast.svelte';
	import SoundButton from '$lib/components/SoundButton.svelte';
	import PlayerBar from '$lib/components/PlayerBar.svelte';
	import PlaylistPicker from '$lib/components/PlaylistPicker.svelte';

	let { data } = $props();
	const editCtx = getContext<{ readonly value: boolean; toggle: () => void }>('editMode');

	let buttons = $state<ButtonConfig[]>(untrack(() => data.buttons.filter((b) => b.playlist_uri)));
	let selectedDeviceId = $state<string | null>(untrack(() => data.selectedDeviceId));

	// ─── Error toast ───
	let errorMsg = $state<string | null>(null);
	let errorTimeout: ReturnType<typeof setTimeout> | undefined;

	function showError(msg: string) {
		errorMsg = msg;
		clearTimeout(errorTimeout);
		errorTimeout = setTimeout(() => (errorMsg = null), 3000);
	}

	// ─── Player state ───
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
				nowPlayingArtist = state.item?.artists?.map((a: { name: string }) => a.name).join(', ') ?? null;
				nowPlayingContextUri = state.context?.uri ?? null;
				volume = state.device?.volume_percent ?? volume;
				progressMs = state.progress_ms ?? 0;
				durationMs = state.item?.duration_ms ?? 0;
				progressUpdatedAt = Date.now();
			}
		} catch { /* ignore */ }
	}

	let volumeTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleVolumeInput(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		volume = val;
		clearTimeout(volumeTimeout);
		volumeTimeout = setTimeout(() => playerAction('volume', val), 150);
	}

	async function playerAction(action: string, value?: boolean | number) {
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

	// ─── Lifecycle ───
	onMount(() => {
		fetchPlayerState();

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

		let interval = setInterval(() => { fetchPlayerState(); refreshConfig(); }, 5000);
		function onVisibility() {
			clearInterval(interval);
			if (!document.hidden) {
				fetchPlayerState();
				refreshConfig();
				interval = setInterval(() => { fetchPlayerState(); refreshConfig(); }, 5000);
			}
		}
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			clearInterval(interval);
			cancelAnimationFrame(raf);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});

	async function refreshConfig() {
		try {
			const res = await fetch('/api/config');
			if (!res.ok) return;
			const config = await res.json();
			const fresh = (config.buttons ?? []).filter((b: ButtonConfig) => b.playlist_uri);
			if (JSON.stringify($state.snapshot(buttons)) !== JSON.stringify(fresh)) {
				buttons = fresh;
				selectedDeviceId = config.selected_device_id ?? selectedDeviceId;
			}
		} catch { /* ignore */ }
	}

	$effect(() => {
		if (editCtx.value) {
			// Preload library when entering edit mode (handled by PlaylistPicker)
		}
	});

	// ─── Playback ───
	let playingId = $state<string | null>(null);

	async function play(btn: ButtonConfig) {
		if (!btn.playlist_uri) return;
		playingId = btn.id;
		setTimeout(() => (playingId = null), 400);
		try {
			const res = await fetch('/api/play', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playlist_uri: btn.playlist_uri, device_id: selectedDeviceId })
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

	let populatedButtons = $derived(buttons.filter((b) => b.playlist_uri));

	// ─── Edit mode ───
	let editingIndex = $state<number | null>(null);

	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	function saveConfig() {
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

	function assignPlaylist(uri: string, name: string, image_url: string | null) {
		if (editingIndex === null) return;
		if (editingIndex === -1) {
			const nextPos = buttons.length > 0 ? Math.max(...buttons.map((b) => b.position)) + 1 : 0;
			buttons.push({ id: `btn-${nextPos}`, position: nextPos, playlist_uri: uri, name, image_url });
		} else {
			buttons[editingIndex] = { ...buttons[editingIndex], playlist_uri: uri, name, image_url };
		}
		editingIndex = null;
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

	function clearCustomImage() {
		if (editingIndex === null || editingIndex < 0) return;
		buttons[editingIndex] = { ...buttons[editingIndex], custom_image_url: null };
		saveConfig();
	}

	function clearButton() {
		if (editingIndex === null || editingIndex === -1) return;
		buttons.splice(editingIndex, 1);
		editingIndex = null;
		saveConfig();
	}

	// ─── Devices ───
	let showDevices = $state(false);
	let devices = $state<Array<{ id: string; name: string; type: string; is_active: boolean }>>([]);

	async function loadDevices() {
		const res = await fetch('/api/devices');
		const json = await res.json();
		devices = json.devices ?? [];
		showDevices = true;
	}

	function selectDevice(id: string | null) {
		selectedDeviceId = id;
		showDevices = false;
		saveConfig();
	}

	let selectedDeviceName = $derived(
		devices.find((d) => d.id === selectedDeviceId)?.name ?? 'Auto'
	);
</script>

{#if errorMsg}
	<Toast message={errorMsg} />
{/if}

<div class="grid">
	{#if editCtx.value}
		{#each buttons as btn, i (btn.id)}
			<SoundButton {btn} editing onclick={() => (editingIndex = i)} />
		{/each}
		<button class="cell add-btn" onclick={() => (editingIndex = -1)}>
			<span class="plus">+</span>
		</button>
	{:else}
		{#each populatedButtons as btn (btn.id)}
			<SoundButton
				{btn}
				playing={playingId === btn.id}
				active={isPlaying && nowPlayingContextUri === btn.playlist_uri}
				onclick={() => play(btn)}
			/>
		{/each}
		{#if populatedButtons.length === 0}
			<div class="empty-state">Tap Edit to add playlists</div>
		{/if}
	{/if}
</div>

<PlayerBar
	{isPlaying}
	{shuffleOn}
	{nowPlayingTrack}
	{nowPlayingArtist}
	{volume}
	{displayProgress}
	{selectedDeviceName}
	{devices}
	{showDevices}
	{selectedDeviceId}
	onplayeraction={playerAction}
	onvolumeinput={handleVolumeInput}
	onloaddevices={loadDevices}
	onselectdevice={selectDevice}
/>

{#if editingIndex !== null}
	<PlaylistPicker
		{editingIndex}
		{buttons}
		onassign={assignPlaylist}
		onuploadimage={uploadImage}
		onclearcustomimage={clearCustomImage}
		onclearbutton={clearButton}
		onclose={() => (editingIndex = null)}
	/>
{/if}

<style>
	.grid {
		display: flex;
		flex-wrap: wrap;
		align-content: start;
		gap: 10px;
		padding: 10px;
		padding-bottom: 180px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	@media (min-width: 768px) {
		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
			grid-auto-rows: min-content;
			align-content: start;
		}
	}

	.add-btn {
		position: relative;
		background: transparent;
		border-radius: var(--radius);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: manipulation;
		width: calc(33.333% - 7px);
		aspect-ratio: 1;
		flex-shrink: 0;
		border: 2px dashed var(--text-muted);
		box-shadow: none;
	}

	@media (min-width: 768px) {
		.add-btn {
			width: auto;
			border-radius: 16px;
		}

		.add-btn:hover {
			border-color: var(--text-dim);
			background: rgba(255, 255, 255, 0.02);
		}
	}

	.plus {
		font-size: 2rem;
		font-weight: 300;
		color: var(--text-muted);
	}

	.empty-state {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 0.95rem;
		font-weight: 300;
		padding: 60px 20px;
		letter-spacing: 0.02em;
	}
</style>
