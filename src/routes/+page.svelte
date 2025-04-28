<script>
	import GameScene from '$lib/GameScene.svelte';
</script>

<div class="game-wrapper">
	<div class="background-grid"></div>
	<GameScene />

	<div class="controls-panel">
		<h2>Controls</h2>
		<ul>
			<li>W - Move up</li>
			<li>A - Move left</li>
			<li>S - Move down</li>
			<li>D - Move right</li>
		</ul>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		position: fixed;
		width: 100%;
		height: 100%;
		font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
		background-color: #000;
	}

	.game-wrapper {
		width: 100%;
		height: 100vh;
		position: relative;
		overflow: hidden;
		background: radial-gradient(circle at center, #1a1a2e 0%, #0f0f1a 100%);
	}

	.background-grid {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image:
			linear-gradient(rgba(50, 50, 80, 0.1) 1px, transparent 1px),
			linear-gradient(90deg, rgba(50, 50, 80, 0.1) 1px, transparent 1px);
		background-size: 20px 20px;
		z-index: 1;
		pointer-events: none;
	}

	.controls-panel {
		position: absolute;
		bottom: 1.5rem;
		right: 1.5rem;
		background: rgba(20, 20, 40, 0.8);
		color: white;
		padding: 0.8rem 1.2rem;
		border-radius: 0.8rem;
		max-width: 200px;
		pointer-events: none;
		box-shadow: 0 0 15px rgba(0, 0, 100, 0.3);
		border: 1px solid rgba(100, 100, 255, 0.3);
		backdrop-filter: blur(5px);
		transform: translateZ(0);
		transition: all 0.3s ease;
	}

	.controls-panel:hover {
		box-shadow: 0 0 20px rgba(100, 100, 255, 0.5);
	}

	.controls-panel h2 {
		margin: 0.5rem 0;
		font-size: 1.3rem;
		color: #9f9fff;
		border-bottom: 1px solid rgba(100, 100, 255, 0.3);
		padding-bottom: 0.3rem;
	}

	.controls-panel ul {
		margin: 0.8rem 0;
		padding-left: 1.5rem;
	}

	.controls-panel li {
		margin: 0.5rem 0;
		font-size: 1rem;
		line-height: 1.4;
	}

	.controls-panel li:before {
		content: '→';
		position: absolute;
		left: 0.5rem;
		color: #9f9fff;
	}

	/* For mobile responsiveness */
	@media (max-width: 768px) {
		.controls-panel {
			max-width: 160px;
			bottom: 1rem;
			right: 1rem;
			padding: 0.5rem 0.8rem;
		}

		.controls-panel h2 {
			font-size: 1.1rem;
		}

		.controls-panel li {
			font-size: 0.9rem;
		}
	}
</style>
