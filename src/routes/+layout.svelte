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
		<div class="brand">
			<h1 class="title">Soundboard</h1>
		</div>
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
	}

	.top-bar {
		height: var(--top-bar-height);
		background: var(--bg-warm);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--surface);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.title {
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text);
	}

	.edit-btn {
		background: var(--surface);
		padding: 7px 22px;
		border-radius: 20px;
		font-size: 0.82rem;
		font-weight: 500;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--text-dim);
		transition: all 0.2s ease;
		border: 1px solid var(--surface-hover);
	}

	.edit-btn:active {
		transform: scale(0.96);
	}

	.edit-btn.active {
		background: var(--accent);
		color: var(--bg);
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
