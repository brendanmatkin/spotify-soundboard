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
	}

	.top-bar {
		height: var(--top-bar-height);
		background: var(--surface);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		flex-shrink: 0;
	}

	.title {
		font-size: 1.2rem;
		font-weight: 600;
	}

	.edit-btn {
		background: var(--surface-hover);
		padding: 8px 20px;
		border-radius: 20px;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.edit-btn.active {
		background: var(--accent);
		color: white;
	}

	.content {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>
