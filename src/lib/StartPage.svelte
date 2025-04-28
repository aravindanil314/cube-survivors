<script>
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	function startGame() {
		dispatch('startGame');
	}
</script>

<div class="start-page">
	<div class="background-grid"></div>
	<div class="cosmic-particles"></div>

	<div class="game-title">
		<h1>COSMIC<br />DEFENDER</h1>
		<div class="title-glow"></div>
	</div>

	<div class="game-description">
		<p>Navigate the cosmic void. Defeat enemies. Collect power-ups.</p>
		<p>How long can you survive?</p>
	</div>

	<button class="start-button" on:click={startGame}>
		<span class="button-text">START GAME</span>
		<div class="button-glow"></div>
	</button>

	<div class="controls-info">
		<h3>CONTROLS</h3>
		<div class="controls-grid">
			<div class="control">
				<span class="key">W</span>
				<span class="action">Move Up</span>
			</div>
			<div class="control">
				<span class="key">A</span>
				<span class="action">Move Left</span>
			</div>
			<div class="control">
				<span class="key">S</span>
				<span class="action">Move Down</span>
			</div>
			<div class="control">
				<span class="key">D</span>
				<span class="action">Move Right</span>
			</div>
		</div>
	</div>
</div>

<style>
	.start-page {
		width: 100%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: radial-gradient(circle at center, #1a1a2e 0%, #0f0f1a 100%);
		position: relative;
		overflow: hidden;
		color: white;
		font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
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
		animation: gridPulse 15s infinite linear;
	}

	@keyframes gridPulse {
		0% {
			opacity: 0.3;
		}
		50% {
			opacity: 0.7;
		}
		100% {
			opacity: 0.3;
		}
	}

	.cosmic-particles {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image: radial-gradient(circle, rgba(255, 255, 255, 0.8) 1px, transparent 1px);
		background-size: 80px 80px;
		z-index: 2;
		animation: particleFloat 100s infinite linear;
	}

	@keyframes particleFloat {
		0% {
			background-position: 0 0;
		}
		100% {
			background-position: 1000px 1000px;
		}
	}

	.game-title {
		position: relative;
		text-align: center;
		margin-bottom: 2rem;
		z-index: 10;
	}

	.game-title h1 {
		font-size: 4.5rem;
		margin: 0;
		line-height: 0.9;
		text-transform: uppercase;
		font-weight: 800;
		letter-spacing: -1px;
		color: transparent;
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
		-webkit-background-clip: text;
		background-clip: text;
		text-shadow: 0 0 10px rgba(79, 172, 254, 0.5);
		animation: titlePulse 3s infinite ease-in-out;
	}

	@keyframes titlePulse {
		0% {
			text-shadow: 0 0 10px rgba(79, 172, 254, 0.5);
		}
		50% {
			text-shadow: 0 0 25px rgba(79, 172, 254, 0.8);
		}
		100% {
			text-shadow: 0 0 10px rgba(79, 172, 254, 0.5);
		}
	}

	.title-glow {
		position: absolute;
		width: 150%;
		height: 150%;
		top: -25%;
		left: -25%;
		background: radial-gradient(circle, rgba(0, 242, 254, 0.15) 0%, transparent 70%);
		z-index: -1;
		pointer-events: none;
	}

	.game-description {
		text-align: center;
		margin-bottom: 3rem;
		max-width: 600px;
		z-index: 10;
	}

	.game-description p {
		font-size: 1.1rem;
		margin: 0.5rem 0;
		color: #a0a0d0;
		text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
	}

	.start-button {
		position: relative;
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
		border: none;
		border-radius: 50px;
		padding: 1.2rem 3.5rem;
		font-size: 1.3rem;
		font-weight: bold;
		color: white;
		text-transform: uppercase;
		letter-spacing: 2px;
		cursor: pointer;
		box-shadow: 0 0 20px rgba(79, 172, 254, 0.5);
		transition: all 0.3s ease;
		margin-bottom: 3rem;
		overflow: hidden;
		z-index: 10;
	}

	.start-button:hover {
		transform: translateY(-3px) scale(1.05);
		box-shadow: 0 0 30px rgba(79, 172, 254, 0.8);
	}

	.start-button:active {
		transform: translateY(1px) scale(0.98);
	}

	.button-text {
		position: relative;
		z-index: 10;
	}

	.button-glow {
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 60%);
		opacity: 0;
		transition: opacity 0.3s ease;
		mix-blend-mode: overlay;
	}

	.start-button:hover .button-glow {
		opacity: 0.5;
		animation: buttonGlow 2s infinite ease-in-out;
	}

	@keyframes buttonGlow {
		0% {
			transform: scale(1);
			opacity: 0.3;
		}
		50% {
			transform: scale(1.1);
			opacity: 0.5;
		}
		100% {
			transform: scale(1);
			opacity: 0.3;
		}
	}

	.controls-info {
		background: rgba(30, 30, 60, 0.6);
		border-radius: 15px;
		padding: 1.5rem 2rem;
		z-index: 10;
		border: 1px solid rgba(79, 172, 254, 0.3);
		backdrop-filter: blur(5px);
	}

	.controls-info h3 {
		text-align: center;
		margin: 0 0 1rem 0;
		color: #9f9fff;
		letter-spacing: 2px;
	}

	.controls-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.control {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		background: rgba(79, 172, 254, 0.3);
		border-radius: 6px;
		color: white;
		font-weight: bold;
		border: 1px solid rgba(79, 172, 254, 0.5);
	}

	.action {
		color: #d0d0ff;
	}

	/* For mobile responsiveness */
	@media (max-width: 768px) {
		.game-title h1 {
			font-size: 3rem;
		}

		.start-button {
			padding: 1rem 2.5rem;
			font-size: 1.1rem;
		}

		.controls-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
