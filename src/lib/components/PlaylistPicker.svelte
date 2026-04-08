<script lang="ts">
  import type { ButtonConfig } from "$lib/types";

  let {
    editingIndex,
    buttons,
    onassign,
    onuploadimage,
    onclearcustomimage,
    onclearbutton,
    onclose,
  }: {
    editingIndex: number;
    buttons: ButtonConfig[];
    onassign: (uri: string, name: string, image_url: string | null) => void;
    onuploadimage: (index: number, file: File) => void;
    onclearcustomimage: () => void;
    onclearbutton: () => void;
    onclose: () => void;
  } = $props();

  let pickerTab = $state<"paste" | "search" | "library">("library");
  let pasteInput = $state("");
  let searchQuery = $state("");
  let searchResults = $state<Array<{ uri: string; name: string; image_url: string | null }>>([]);
  let libraryPlaylists = $state<Array<{ uri: string; name: string; image_url: string | null }>>([]);
  let libraryLoaded = $state(false);
  let loading = $state(false);
  let libraryFilter = $state("");

  let filteredLibrary = $derived(
    libraryFilter
      ? libraryPlaylists.filter((p) => p.name.toLowerCase().includes(libraryFilter.toLowerCase()))
      : libraryPlaylists,
  );

  let currentButton = $derived(
    editingIndex >= 0 && editingIndex < buttons.length ? buttons[editingIndex] : null,
  );

  export async function loadLibrary() {
    if (libraryLoaded) return;
    loading = true;
    try {
      const res = await fetch("/api/playlists");
      const json = await res.json();
      libraryPlaylists = json.playlists ?? [];
      libraryLoaded = true;
    } finally {
      loading = false;
    }
  }

  // Auto-load library on open
  loadLibrary();

  async function pasteAdd() {
    if (!pasteInput.trim()) return;
    loading = true;
    try {
      const res = await fetch(`/api/playlist-details?uri=${encodeURIComponent(pasteInput.trim())}`);
      if (!res.ok) {
        loading = false;
        return;
      }
      const pl = await res.json();
      onassign(pl.uri, pl.name, pl.image_url);
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
</script>

<div class="modal-overlay" onclick={onclose} role="presentation">
  <div
    class="modal"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && onclose()}
    role="dialog"
    tabindex="-1"
  >
    <div class="modal-header">
      <h2>Choose Playlist</h2>
      <button class="close-btn" onclick={onclose}>&#x2715;</button>
    </div>

    <div class="tabs">
      <button class:active={pickerTab === "paste"} onclick={() => (pickerTab = "paste")}
        >Paste URL</button
      >
      <button class:active={pickerTab === "search"} onclick={() => (pickerTab = "search")}
        >Search</button
      >
      <button
        class:active={pickerTab === "library"}
        onclick={() => {
          pickerTab = "library";
          loadLibrary();
        }}>My Playlists</button
      >
    </div>

    <div class="modal-body">
      {#if pickerTab === "paste"}
        <div class="input-row">
          <input
            type="text"
            placeholder="Spotify playlist URL or URI"
            bind:value={pasteInput}
            class="input-field"
            onkeydown={(e) => e.key === "Enter" && pasteAdd()}
          />
          <button class="btn-accent" onclick={pasteAdd} disabled={loading}
            >{loading ? "..." : "Add"}</button
          >
        </div>
      {:else if pickerTab === "search"}
        <div class="input-row">
          <input
            type="text"
            placeholder="Search playlists..."
            bind:value={searchQuery}
            class="input-field"
            onkeydown={(e) => e.key === "Enter" && doSearch()}
          />
          <button class="btn-accent" onclick={doSearch} disabled={loading}
            >{loading ? "..." : "Search"}</button
          >
        </div>
        <div class="results">
          {#each searchResults as pl, i (i)}
            <button class="result-item" onclick={() => onassign(pl.uri, pl.name, pl.image_url)}>
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
            class="input-field"
          />
        </div>
        {#if loading}
          <p class="loading-text">Loading...</p>
        {/if}
        <div class="results">
          {#each filteredLibrary as pl, i (i)}
            <button class="result-item" onclick={() => onassign(pl.uri, pl.name, pl.image_url)}>
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
      <label class="btn-subtle upload-label">
        Custom Image
        <input
          type="file"
          accept="image/*"
          onchange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) onuploadimage(editingIndex, file);
          }}
        />
      </label>
      {#if currentButton?.custom_image_url}
        <button class="btn-ghost" onclick={onclearcustomimage}>Reset Image</button>
      {/if}
      {#if currentButton?.playlist_uri}
        <button class="btn-danger" onclick={onclearbutton}>Remove</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--modal-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
    animation: fade-in 0.2s ease;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal {
    background: var(--modal-bg);
    border-radius: var(--radius);
    width: 100%;
    max-width: 480px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: var(--modal-border);
    box-shadow: var(--modal-shadow);
    animation: modal-in 0.25s cubic-bezier(0.2, 0, 0, 1);
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
  }

  .modal-header h2 {
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .close-btn {
    background: var(--surface-hover);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    color: var(--text-dim);
    transition: background 0.15s ease;
  }

  .close-btn:active {
    background: var(--surface-raised);
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 0 16px;
    margin-bottom: 4px;
  }

  .tabs button {
    flex: 1;
    padding: 8px;
    background: none;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.02em;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .tabs button.active {
    background: var(--surface-hover);
    color: var(--text);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px;
  }

  /* input-field, btn-accent, btn-subtle, btn-ghost, btn-danger styled globally in app.css */

  .input-row {
    display: flex;
    gap: 8px;
  }

  .input-row :global(.input-field) {
    flex: 1;
  }

  .filter-form {
    margin-bottom: 10px;
  }
  .filter-form :global(.input-field) {
    width: 100%;
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 10px;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    background: none;
    border-radius: var(--radius-sm);
    text-align: left;
    font-size: 0.85rem;
    transition: background 0.1s ease;
  }

  .result-item:hover,
  .result-item:active {
    background: var(--surface-hover);
  }

  .result-img {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .result-img.placeholder {
    background: var(--surface-hover);
  }

  .loading-text {
    color: var(--text-muted);
    text-align: center;
    padding: 24px;
    font-weight: 300;
    font-size: 0.9rem;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid var(--surface-hover);
  }

  .upload-label {
    cursor: pointer;
    touch-action: manipulation;
  }

  .upload-label input {
    display: none;
  }

  .modal-footer :global(.btn-danger) {
    margin-left: auto;
    padding: 8px 16px;
    background: var(--danger);
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition: background 0.15s ease;
  }
</style>
