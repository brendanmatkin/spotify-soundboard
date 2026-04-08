<script lang="ts">
  import type { SpotifyDevice } from "$lib/types";

  let {
    isPlaying,
    shuffleOn,
    nowPlayingTrack,
    nowPlayingArtist,
    volume,
    displayProgress,
    backend,
    contextSource,
    selectedDeviceName,
    devices,
    showDevices,
    selectedDeviceId,
    onplayeraction,
    onvolumeinput,
    onloaddevices,
    onselectdevice,
    onselectbackend,
  }: {
    isPlaying: boolean;
    shuffleOn: boolean;
    nowPlayingTrack: string | null;
    nowPlayingArtist: string | null;
    volume: number;
    displayProgress: number;
    backend: "sonos" | "spotify";
    contextSource: "api" | "optimistic" | null;
    selectedDeviceName: string;
    devices: SpotifyDevice[];
    showDevices: boolean;
    selectedDeviceId: string | null;
    onplayeraction: (action: string, value?: boolean | number) => void;
    onvolumeinput: (e: Event) => void;
    onloaddevices: () => void;
    onselectdevice: (id: string | null) => void;
    onselectbackend: (backend: "sonos" | "spotify") => void;
  } = $props();
</script>

<div class="bottom-bar">
  <div class="progress-bar" style:--progress="{displayProgress * 100}%"></div>

  <div class="bar-row-1">
    <div class="controls">
      <button
        class="ctrl-btn"
        class:active={shuffleOn}
        onclick={() => onplayeraction("shuffle", !shuffleOn)}
        title="Shuffle">&#x21C4;</button
      >
      <button class="ctrl-btn" onclick={() => onplayeraction("prev")} title="Previous"
        >&#x23EE;</button
      >
      <button
        class="ctrl-btn play-pause"
        onclick={() => onplayeraction(isPlaying ? "pause" : "resume")}
        title={isPlaying ? "Pause" : "Play"}
      >
        {#if isPlaying}<span class="pause-icon"></span>{:else}&#x25B6;{/if}
      </button>
      <button class="ctrl-btn" onclick={() => onplayeraction("next")} title="Next">&#x23ED;</button>
    </div>
    <input
      type="range"
      class="vol-slider"
      min="0"
      max="100"
      value={volume}
      oninput={onvolumeinput}
      style:--fill="{volume}%"
    />
  </div>

  <div class="bar-row-2">
    <div class="route-controls">
      <button
        class="backend-btn"
        class:active={backend === "sonos"}
        onclick={() => onselectbackend("sonos")}
      >
        Sonos
      </button>
      <button
        class="backend-btn"
        class:active={backend === "spotify"}
        onclick={() => onselectbackend("spotify")}
      >
        Spotify
      </button>
    </div>

    <button class="device-btn" onclick={onloaddevices}>
      &#x266A; {selectedDeviceName}
    </button>

    <div class="controls desktop-only">
      <button
        class="ctrl-btn"
        class:active={shuffleOn}
        onclick={() => onplayeraction("shuffle", !shuffleOn)}
        title="Shuffle">&#x21C4;</button
      >
      <button class="ctrl-btn" onclick={() => onplayeraction("prev")} title="Previous"
        >&#x23EE;</button
      >
      <button
        class="ctrl-btn play-pause"
        onclick={() => onplayeraction(isPlaying ? "pause" : "resume")}
        title={isPlaying ? "Pause" : "Play"}
      >
        {#if isPlaying}<span class="pause-icon"></span>{:else}&#x25B6;{/if}
      </button>
      <button class="ctrl-btn" onclick={() => onplayeraction("next")} title="Next">&#x23ED;</button>
      <input
        type="range"
        class="vol-slider vol-desktop"
        min="0"
        max="100"
        value={volume}
        oninput={onvolumeinput}
        style:--fill="{volume}%"
      />
    </div>

    <div class="now-playing">
      {#if nowPlayingTrack}
        {#if contextSource}
          <span class="context-badge" class:optimistic={contextSource === "optimistic"}>
            {contextSource === "optimistic" ? "Syncing" : "Live"}
          </span>
        {/if}
        <span class="track-name">{nowPlayingTrack}</span>
        {#if nowPlayingArtist}<span class="track-artist">&middot; {nowPlayingArtist}</span>{/if}
      {:else}
        <span class="track-name dimmed">Not playing</span>
      {/if}
    </div>
  </div>

  {#if showDevices}
    <div class="device-dropdown">
      <button class="device-option" onclick={() => onselectdevice(null)}>
        Auto (active device)
      </button>
      {#each devices as device (device.id)}
        <button
          class="device-option"
          class:active={selectedDeviceId === device.id}
          onclick={() => onselectdevice(device.id)}
        >
          {device.name} ({device.type})
          {#if device.is_active}<span class="active-dot"></span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    background: var(--bar-bg);
    border-top: var(--bar-border);
    z-index: 50;
    backdrop-filter: var(--bar-blur);
    -webkit-backdrop-filter: var(--bar-blur);
  }

  .progress-bar {
    height: 3px;
    background: linear-gradient(
      to right,
      var(--progress-fill) var(--progress, 0%),
      var(--progress-track) var(--progress, 0%)
    );
    margin-bottom: 6px;
  }

  .bar-row-1 {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 4px 16px;
  }

  .bar-row-2 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 16px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  }

  .controls.desktop-only {
    display: none;
  }

  .route-controls {
    display: flex;
    gap: 6px;
  }

  .backend-btn {
    background: var(--ctrl-bg);
    border: 1px solid transparent;
    color: var(--text-muted);
    padding: 5px 9px;
    font-size: 0.68rem;
    border-radius: var(--radius-sm);
  }

  .backend-btn.active {
    color: var(--text-main);
    border-color: var(--accent, #f5f5f5);
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
      grid-template-columns: auto auto 1fr auto;
      align-items: center;
      padding: 6px 20px 10px;
    }
    .controls.desktop-only {
      display: flex;
    }
  }

  .device-btn {
    background: var(--ctrl-bg);
    padding: 5px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--text-dim);
    white-space: nowrap;
    width: fit-content;
    justify-self: start;
    border: var(--ctrl-border);
    transition: background 0.15s ease;
  }

  .device-btn:active {
    background: var(--surface-hover);
  }

  .context-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    margin-right: 8px;
    border-radius: 999px;
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    background: rgba(180, 215, 180, 0.2);
    border: 1px solid rgba(180, 215, 180, 0.35);
    color: var(--text-dim);
  }

  .context-badge.optimistic {
    background: rgba(230, 210, 140, 0.2);
    border-color: rgba(230, 210, 140, 0.35);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .ctrl-btn {
    background: var(--ctrl-bg);
    width: 54px;
    height: 54px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    color: var(--ctrl-color);
    touch-action: manipulation;
    transition:
      color 0.15s ease,
      background 0.15s ease;
    border: var(--ctrl-border);
  }

  .ctrl-btn:active {
    background: var(--ctrl-active-bg);
  }
  .ctrl-btn.active {
    color: var(--accent);
  }

  .ctrl-btn.play-pause {
    width: 52px;
    height: 52px;
    background: var(--ctrl-play-bg);
    color: var(--ctrl-play-color);
    font-size: 1rem;
    border: none;
    transition:
      transform 0.15s ease,
      background 0.15s ease;
  }

  .ctrl-btn.play-pause:active {
    transform: scale(0.9);
    background: var(--accent-dim);
  }

  .pause-icon {
    display: flex;
    gap: 3px;
  }
  .pause-icon::before,
  .pause-icon::after {
    content: "";
    width: 4px;
    height: 14px;
    background: currentColor;
    border-radius: 1px;
  }

  /* vol-slider styled globally in app.css */

  .now-playing {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
  }

  .track-name {
    font-family: var(--font-display, inherit);
    font-size: 0.75rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
  }

  .track-name.dimmed {
    color: var(--text-muted);
    font-weight: 400;
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
    left: 16px;
    background: var(--modal-bg);
    border-radius: var(--radius);
    padding: 6px;
    min-width: 240px;
    box-shadow: var(--modal-shadow);
    z-index: 10;
    border: var(--modal-border);
  }

  .device-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    text-align: left;
    transition: background 0.1s ease;
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
    box-shadow: 0 0 6px var(--accent-glow);
  }
</style>
