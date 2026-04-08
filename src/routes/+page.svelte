<script lang="ts">
  import { getContext, untrack, onMount } from "svelte";
  import type { ButtonConfig } from "$lib/types";
  import Toast from "$lib/components/Toast.svelte";
  import SoundButton from "$lib/components/SoundButton.svelte";
  import PlayerBar from "$lib/components/PlayerBar.svelte";
  import PlaylistPicker from "$lib/components/PlaylistPicker.svelte";

  let { data } = $props();
  const editCtx = getContext<{ readonly value: boolean; toggle: () => void }>("editMode");

  let buttons = $state<ButtonConfig[]>(untrack(() => data.buttons.filter((b) => b.playlist_uri)));
  let playbackBackend = $state<"sonos" | "spotify">(untrack(() => data.playbackBackend ?? "sonos"));
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
  let nowPlayingContextSource = $state<"api" | "optimistic" | null>(null);
  let volume = $state(50);
  let progressMs = $state(0);
  let durationMs = $state(0);
  let progressUpdatedAt = $state(0);
  let displayProgress = $state(0);
  let optimisticPlayTarget = $state<boolean | null>(null);
  let optimisticPlayUntil = $state(0);
  let optimisticHighlightTarget = $state<string | null>(null);
  let optimisticHighlightUntil = $state(0);

  async function fetchPlayerState() {
    try {
      const res = await fetch("/api/player");
      if (!res.ok) return;
      const state = await res.json();
      if (state) {
        const serverIsPlaying = state.playbackState === "PLAYING";

        // Ignore a brief stale state right after optimistic play/pause.
        if (
          optimisticPlayTarget !== null &&
          Date.now() < optimisticPlayUntil &&
          serverIsPlaying !== optimisticPlayTarget
        ) {
          // Keep optimistic isPlaying until Sonos state catches up.
        } else {
          isPlaying = serverIsPlaying;
          if (optimisticPlayTarget !== null && serverIsPlaying === optimisticPlayTarget) {
            optimisticPlayTarget = null;
            optimisticPlayUntil = 0;
          }
        }
        shuffleOn = state.playMode?.shuffle ?? false;
        nowPlayingTrack = state.currentTrack?.title ?? null;
        nowPlayingArtist = state.currentTrack?.artist ?? null;
        const now = Date.now();
        const nextContextUri = state.contextUri ?? null;
        if (
          optimisticHighlightTarget !== null &&
          now < optimisticHighlightUntil &&
          nextContextUri !== null &&
          nextContextUri !== optimisticHighlightTarget
        ) {
          // Keep optimistic playlist highlight until backend context catches up.
        } else if (nextContextUri) {
          nowPlayingContextUri = nextContextUri;
          nowPlayingContextSource = "api";
          if (optimisticHighlightTarget === nextContextUri) {
            optimisticHighlightTarget = null;
            optimisticHighlightUntil = 0;
          }
        } else if (playbackBackend === "spotify") {
          nowPlayingContextUri = null;
          nowPlayingContextSource = null;
        }
        if (optimisticHighlightTarget !== null && now >= optimisticHighlightUntil) {
          optimisticHighlightTarget = null;
          optimisticHighlightUntil = 0;
          if (nowPlayingContextSource === "optimistic" && !nextContextUri) {
            nowPlayingContextSource = null;
          }
        }
        volume = state.volume ?? volume;
        progressMs = (state.elapsedTime ?? 0) * 1000;
        progressUpdatedAt = Date.now();
        durationMs = (state.currentTrack?.duration ?? 0) * 1000;
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
    volumeTimeout = setTimeout(() => playerAction("volume", val), 150);
  }

  async function playerAction(action: string, value?: boolean | number) {
    const prevIsPlaying = isPlaying;

    // Optimistic UI toggle for snappy play/pause controls.
    if (action === "pause") {
      optimisticPlayTarget = false;
      optimisticPlayUntil = Date.now() + 2500;
      if (progressUpdatedAt > 0 && durationMs > 0) {
        const elapsed = Date.now() - progressUpdatedAt;
        progressMs = Math.min(progressMs + elapsed, durationMs);
      }
      isPlaying = false;
    } else if (action === "resume") {
      optimisticPlayTarget = true;
      optimisticPlayUntil = Date.now() + 2500;
      isPlaying = true;
      progressUpdatedAt = Date.now();
    }

    try {
      const res = await fetch("/api/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value }),
      });
      if (!res.ok) {
        isPlaying = prevIsPlaying;
        optimisticPlayTarget = null;
        optimisticPlayUntil = 0;
        const d = await res.json().catch(() => ({}));
        showError(d.message ?? `${action} failed`);
      }
      setTimeout(fetchPlayerState, 300);
    } catch {
      isPlaying = prevIsPlaying;
      optimisticPlayTarget = null;
      optimisticPlayUntil = 0;
      showError("Network error");
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

    let interval = setInterval(() => {
      fetchPlayerState();
      refreshConfig();
    }, 5000);
    function onVisibility() {
      clearInterval(interval);
      if (!document.hidden) {
        fetchPlayerState();
        refreshConfig();
        interval = setInterval(() => {
          fetchPlayerState();
          refreshConfig();
        }, 5000);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  });

  async function refreshConfig() {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) return;
      const config = await res.json();
      const fresh = (config.buttons ?? []).filter((b: ButtonConfig) => b.playlist_uri);
      if (JSON.stringify($state.snapshot(buttons)) !== JSON.stringify(fresh)) {
        buttons = fresh;
        playbackBackend = config.playback_backend ?? playbackBackend;
        selectedDeviceId = config.selected_device_id ?? selectedDeviceId;
      }
    } catch {
      /* ignore */
    }
  }

  $effect(() => {
    if (editCtx.value) {
      // Preload library when entering edit mode (handled by PlaylistPicker)
    }
  });

  // ─── Playback ───
  let playingId = $state<string | null>(null);
  let lastPlayedUri = $state<string | null>(null);

  async function play(btn: ButtonConfig) {
    if (!btn.playlist_uri) return;
    const prevContextUri = nowPlayingContextUri;
    const prevContextSource = nowPlayingContextSource;
    playingId = btn.id;
    lastPlayedUri = btn.playlist_uri;
    nowPlayingContextUri = btn.playlist_uri;
    nowPlayingContextSource = "optimistic";
    optimisticHighlightTarget = btn.playlist_uri;
    optimisticHighlightUntil = Date.now() + 3500;
    setTimeout(() => (playingId = null), 400);
    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlist_uri: btn.playlist_uri }),
      });
      if (!res.ok) {
        nowPlayingContextUri = prevContextUri;
        nowPlayingContextSource = prevContextSource;
        optimisticHighlightTarget = null;
        optimisticHighlightUntil = 0;
        const d = await res.json().catch(() => ({ message: "Playback failed" }));
        showError(d.message ?? "Playback failed");
      }
      setTimeout(fetchPlayerState, 500);
    } catch {
      nowPlayingContextUri = prevContextUri;
      nowPlayingContextSource = prevContextSource;
      optimisticHighlightTarget = null;
      optimisticHighlightUntil = 0;
      showError("Network error");
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
        await fetch("/api/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buttons: $state.snapshot(buttons),
            grid_size: buttons.length,
            playback_backend: playbackBackend,
            selected_device_id: selectedDeviceId,
          }),
        });
      } catch {
        showError("Failed to save config");
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
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Image upload failed" }));
      showError(err.message ?? "Image upload failed");
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
    const res = await fetch("/api/devices");
    const json = await res.json();
    devices = json.devices ?? [];
    showDevices = true;
  }

  async function selectDevice(id: string | null) {
    selectedDeviceId = id;
    showDevices = false;
    saveConfig();
    if (playbackBackend === "spotify" && id) {
      try {
        await fetch("/api/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: id }),
        });
        setTimeout(fetchPlayerState, 600);
      } catch {
        /* ignore */
      }
    }
  }

  async function selectBackend(backend: "sonos" | "spotify") {
    if (playbackBackend === backend) return;

    try {
      await fetch("/api/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
    } catch {
      /* ignore */
    }

    // Prefer what's currently playing; fall back to last tapped playlist
    const uriToResume = nowPlayingContextUri ?? lastPlayedUri;
    playbackBackend = backend;
    isPlaying = false;
    nowPlayingContextSource = null;
    optimisticHighlightTarget = null;
    optimisticHighlightUntil = 0;
    selectedDeviceId = null;
    devices = [];
    showDevices = false;

    // Flush config immediately so /api/play reads the correct backend
    try {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buttons: $state.snapshot(buttons),
          grid_size: buttons.length,
          playback_backend: backend,
          selected_device_id: null,
        }),
      });
    } catch {
      /* ignore */
    }

    if (uriToResume) {
      try {
        await fetch("/api/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playlist_uri: uriToResume }),
        });
      } catch {
        /* ignore */
      }
    }

    fetchPlayerState();
  }

  let selectedDeviceName = $derived(devices.find((d) => d.id === selectedDeviceId)?.name ?? "Auto");
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
  backend={playbackBackend}
  contextSource={nowPlayingContextSource}
  {selectedDeviceName}
  {devices}
  {showDevices}
  {selectedDeviceId}
  onplayeraction={playerAction}
  onvolumeinput={handleVolumeInput}
  onloaddevices={loadDevices}
  onselectdevice={selectDevice}
  onselectbackend={selectBackend}
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
