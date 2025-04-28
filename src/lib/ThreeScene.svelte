<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;

	onMount(() => {
		if (!canvas) return;

		// Create scene
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x1a1a1a);

		// Camera
		const camera = new THREE.PerspectiveCamera(
			75,
			container.clientWidth / container.clientHeight,
			0.1,
			1000
		);
		camera.position.z = 5;

		// Renderer
		const renderer = new THREE.WebGLRenderer({
			antialias: true,
			canvas: canvas
		});
		renderer.setSize(container.clientWidth, container.clientHeight);

		// Add a cube
		const geometry = new THREE.BoxGeometry();
		const material = new THREE.MeshNormalMaterial();
		const cube = new THREE.Mesh(geometry, material);
		scene.add(cube);

		// Handle window resize
		const handleResize = () => {
			camera.aspect = container.clientWidth / container.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(container.clientWidth, container.clientHeight);
		};

		window.addEventListener('resize', handleResize);

		// Animation loop
		const animate = () => {
			requestAnimationFrame(animate);

			cube.rotation.x += 0.01;
			cube.rotation.y += 0.01;

			renderer.render(scene, camera);
		};

		animate();

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div bind:this={container} class="h-full w-full">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	div {
		min-height: 400px;
	}
</style>
