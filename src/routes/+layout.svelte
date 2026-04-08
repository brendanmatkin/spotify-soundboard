<script lang="ts">
	import '../app.css';
	import { setContext } from 'svelte';

	let { children } = $props();
	let editMode = $state(false);

	setContext('editMode', {
		get value() { return editMode; },
		toggle() { editMode = !editMode; }
	});
</script>

<div class="app">
	<header class="top-bar">
		<h1 class="title">Soundboard</h1>
		<button
			class="edit-btn"
			class:active={editMode}
			onclick={() => editMode = !editMode}
		>
			{editMode ? 'Done' : 'Edit'}
		</button>
	</header>
	<main class="content">
		{@render children()}
	</main>
</div>

<style>
	.app {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		position: relative;
		z-index: 1;
	}

	.top-bar {
		height: var(--top-bar-height);
		background: var(--bg-warm);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px;
		flex-shrink: 0;
		border-bottom: var(--bar-border);
	}

	.title {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
		letter-spacing: 0.1em;
		color: var(--accent);
	}

	.edit-btn {
		background: var(--surface);
		padding: 6px 18px;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-dim);
		transition: all 0.2s ease;
		border: var(--ctrl-border);
	}

	.edit-btn:active {
		transform: scale(0.96);
	}

	.edit-btn.active {
		background: var(--accent);
		color: var(--text);
		border-color: var(--accent);
		font-weight: 600;
	}

	.content {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>
