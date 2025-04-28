<script lang="ts">
	import { onMount } from 'svelte';
	import { Game } from './game/Game';

	let container: HTMLDivElement;
	let game: Game;
	let resizeObserver: ResizeObserver;
	let isLoading = true;

	export function cleanup() {
		if (game) {
			game.cleanup();
		}
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
	}

	onMount(() => {
		// Initialize the game
		game = new Game(container);
		game.start();

		// Hide loading indicator once game starts
		setTimeout(() => {
			isLoading = false;
		}, 800);

		// Set up resize observer for responsive canvas
		resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(container);

		return () => {
			cleanup();
		};
	});

	function handleResize() {
		if (game && game.handleContainerResize) {
			game.handleContainerResize();
		}
	}
</script>

<div bind:this={container} class="game-container">
	{#if isLoading}
		<div class="loading-indicator">Loading...</div>
	{/if}
</div>

<style>
	.game-container {
		width: 100%;
		height: 100vh;
		overflow: hidden;
		position: relative;
		background-color: #070715;
		display: block;
		margin: 0;
		padding: 0;
		box-shadow: inset 0 0 50px rgba(0, 0, 100, 0.3);
		z-index: 5;
	}

	.loading-indicator {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: rgba(150, 150, 255, 0.8);
		font-size: 1.2rem;
		text-shadow: 0 0 10px rgba(100, 100, 255, 0.5);
		opacity: 1;
		animation: pulse 1.5s infinite ease-in-out;
		pointer-events: none;
		z-index: 100;
	}

	@keyframes pulse {
		0% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0.5;
		}
	}

	/* For mobile devices, ensure the height is proper */
	@media (max-width: 768px) {
		.game-container {
			height: 100svh; /* Use svh (small viewport height) for better mobile support */
		}

		.loading-indicator {
			font-size: 1rem;
		}
	}
</style>
