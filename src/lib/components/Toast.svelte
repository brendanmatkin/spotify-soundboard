<script lang="ts">
	let { message }: { message: string } = $props();
</script>

<div class="toast">{message}</div>

<style>
	.toast {
		position: fixed;
		top: 16px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--toast-bg);
		color: var(--text);
		padding: 10px 24px;
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		z-index: 200;
		animation: toast-in 0.3s cubic-bezier(0.2, 0, 0, 1);
		box-shadow: var(--toast-shadow);
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-16px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0) scale(1);
		}
	}
</style>
