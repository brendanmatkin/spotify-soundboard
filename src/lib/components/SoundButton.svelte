<script lang="ts">
  import type { ButtonConfig } from "$lib/types";

  let {
    btn,
    editing = false,
    playing = false,
    active = false,
    onclick,
  }: {
    btn: ButtonConfig;
    editing?: boolean;
    playing?: boolean;
    active?: boolean;
    onclick: () => void;
  } = $props();

  let imgSrc = $derived(btn.custom_image_url ?? btn.image_url);
</script>

<button
  class="cell"
  class:edit-mode={editing}
  class:playing
  class:active-playlist={active}
  {onclick}
>
  {#if imgSrc}
    <img src={imgSrc} alt="" loading="lazy" class="artwork" />
  {/if}
  {#if btn.playlist_uri}
    <span class="label">{btn.name ?? "Playlist"}</span>
  {:else}
    <span class="plus">+</span>
  {/if}
  {#if editing}
    <span class="edit-badge">&#x270E;</span>
  {/if}
</button>

<style>
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
    transition:
      transform 0.2s cubic-bezier(0.2, 0, 0, 1),
      box-shadow 0.3s ease;
    width: calc(33.333% - 7px);
    aspect-ratio: 1;
    flex-shrink: 0;
    box-shadow: var(--card-shadow);
    border: var(--card-border);
  }

  @media (min-width: 768px) {
    .cell {
      width: auto;
      border-radius: var(--radius);
    }

    .cell:hover {
      transform: scale(1.03);
      box-shadow: var(--card-shadow-hover);
    }
  }

  .cell:active {
    transform: scale(0.94);
  }

  .cell.active-playlist {
    box-shadow: var(--card-shadow-active);
  }

  .cell.playing {
    animation: pulse 0.5s cubic-bezier(0.2, 0, 0, 1);
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 var(--card-glow-pulse);
    }
    50% {
      box-shadow: 0 0 0 14px transparent;
    }
    100% {
      box-shadow: var(--card-shadow);
    }
  }

  .artwork {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .cell:active .artwork {
    transform: scale(1.05);
  }

  .label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    background: var(--label-bg);
    font-family: var(--font-display, inherit);
    font-size: clamp(0.9rem, 5cqi, 1.6rem);
    font-weight: 700;
    letter-spacing: 0.02em;
    text-align: center;
    text-shadow: var(--label-shadow);
    line-height: 1.2;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .plus {
    font-size: 2rem;
    font-weight: 300;
    color: var(--text-muted);
  }

  .edit-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--edit-badge-bg);
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    border: var(--edit-badge-border);
  }

  .edit-mode {
    outline: var(--edit-outline);
    outline-offset: -1px;
  }
</style>
