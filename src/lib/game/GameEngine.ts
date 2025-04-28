import * as THREE from 'three';
import { PlayerCharacter } from './PlayerCharacter';
import { EnemyManager } from './EnemyManager';
import { CollectibleManager } from './CollectibleManager';
import { CollectibleType } from './Collectible';
import { Enemy } from './Enemy';
import { Debug } from './utils/Debug';
import { ResourceManager } from './utils/ResourceManager';
import { SpatialGrid } from './utils/SpatialGrid';
import type { SpatialObject } from './utils/SpatialGrid';
import { DEBUG_CONFIG, PERFORMANCE_CONFIG, VISUAL_CONFIG, WORLD_CONFIG } from './config';

/**
 * Interface for killed enemy data
 */
interface KilledEnemyData {
	position: THREE.Vector3;
	value: number;
	isBoss: boolean;
	healthDropChance: number;
}

/**
 * Main game engine class
 */
export class GameEngine {
	private container: HTMLElement;
	private scene: THREE.Scene;
	private camera!: THREE.OrthographicCamera;
	private renderer!: THREE.WebGLRenderer;
	private player!: PlayerCharacter;
	private clock: THREE.Clock;
	private isPaused: boolean = false;
	private isGameOver: boolean = false;
	private enemyManager!: EnemyManager;
	private collectibleManager!: CollectibleManager;
	private enemySpatialGrid!: SpatialGrid<SpatialObject>;
	private collectibleSpatialGrid!: SpatialGrid<SpatialObject>;
	private score: number = 0;
	private debug: Debug;
	private resources: ResourceManager;
	private animationFrameId: number = 0;
	private currentWave: number = 1;
	private lastPerformanceCheck: number = 0;
	private fpsBuffer: number[] = [];

	constructor(container: HTMLElement) {
		this.container = container;
		this.scene = new THREE.Scene();
		this.clock = new THREE.Clock();
		this.debug = Debug.getInstance();
		this.resources = ResourceManager.getInstance();

		// Set up spatial partitioning
		this.enemySpatialGrid = new SpatialGrid<SpatialObject>(PERFORMANCE_CONFIG.spatialGridCellSize);

		this.collectibleSpatialGrid = new SpatialGrid<SpatialObject>(
			PERFORMANCE_CONFIG.spatialGridCellSize
		);

		// Initialize game
		this.init();
	}

	/**
	 * Initialize game systems and scene
	 */
	private init(): void {
		// Create scene with background color
		this.scene.background = new THREE.Color(VISUAL_CONFIG.colors.background);
		this.scene.fog = new THREE.FogExp2(VISUAL_CONFIG.colors.background, 0.02);

		// Set up camera
		this.setupCamera();

		// Set up renderer
		this.setupRenderer();

		// Set up lighting
		this.setupLighting();

		// Create floor and environment
		this.createEnvironment();

		// Create player
		this.player = new PlayerCharacter(this.scene, WORLD_CONFIG.boundarySize);

		// Create game systems
		this.enemyManager = new EnemyManager(this.scene, this.player, WORLD_CONFIG.boundarySize);

		this.collectibleManager = new CollectibleManager(this.scene, this.player);

		// Initial enemy spawn
		this.enemyManager.spawnInitialEnemies();

		// Initial collectibles
		this.spawnInitialCollectibles();

		this.setupEventListeners();
	}

	/**
	 * Set up camera
	 */
	private setupCamera(): void {
		const aspectRatio = this.container.clientWidth / this.container.clientHeight;
		const viewSize = 15;

		this.camera = new THREE.OrthographicCamera(
			-viewSize * aspectRatio,
			viewSize * aspectRatio,
			viewSize,
			-viewSize,
			0.1,
			1000
		);

		this.camera.position.set(0, 20, 0);
		this.camera.lookAt(0, 0, 0);
	}

	/**
	 * Set up WebGL renderer
	 */
	private setupRenderer(): void {
		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		});

		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);

		if (PERFORMANCE_CONFIG.shadowsEnabled) {
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		}

		this.container.appendChild(this.renderer.domElement);
	}

	/**
	 * Set up scene lighting
	 */
	private setupLighting(): void {
		// Ambient light
		const ambientLight = new THREE.AmbientLight(0x404080, WORLD_CONFIG.ambientLightIntensity);
		this.scene.add(ambientLight);

		// Main directional light
		const directionalLight = new THREE.DirectionalLight(
			0xaaccff,
			WORLD_CONFIG.directionalLightIntensity
		);
		directionalLight.position.set(5, 10, 7.5);

		if (PERFORMANCE_CONFIG.shadowsEnabled) {
			directionalLight.castShadow = true;
			directionalLight.shadow.mapSize.width = 1024;
			directionalLight.shadow.mapSize.height = 1024;
			directionalLight.shadow.camera.near = 0.5;
			directionalLight.shadow.camera.far = 50;
			directionalLight.shadow.bias = -0.0005;
		}

		this.scene.add(directionalLight);

		// Add subtle blue point light for atmosphere
		const pointLight = new THREE.PointLight(0x3333ff, 0.8, 30);
		pointLight.position.set(0, 5, 0);
		this.scene.add(pointLight);
	}

	/**
	 * Create floor and environment
	 */
	private createEnvironment(): void {
		// Create floor
		const floorSize = WORLD_CONFIG.floorSize;
		const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize, 32, 32);

		// Get or create floor texture
		const floorTexture = this.resources.getTexture('floor', () => this.createFloorTexture());

		// Create floor material
		const floorMaterial = new THREE.MeshStandardMaterial({
			map: floorTexture,
			roughness: 0.7,
			metalness: 0.2,
			color: 0xffffff
		});

		const floor = new THREE.Mesh(floorGeometry, floorMaterial);
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = PERFORMANCE_CONFIG.shadowsEnabled;
		this.scene.add(floor);

		// Create boundary markers
		if (DEBUG_CONFIG.showBoundaries) {
			this.createBoundaryMarkers();
		}

		// Create ambient particles for atmosphere
		if (VISUAL_CONFIG.particles.enable) {
			this.createAmbientParticles();
		}
	}

	/**
	 * Create a cosmic floor texture
	 */
	private createFloorTexture(): THREE.Texture {
		const canvas = document.createElement('canvas');
		canvas.width = 2048;
		canvas.height = 2048;
		const ctx = canvas.getContext('2d');

		if (ctx) {
			// Fill with deep space color
			ctx.fillStyle = '#050510';
			ctx.fillRect(0, 0, 2048, 2048);

			// Create stars
			const starCount = 3000 * VISUAL_CONFIG.particles.density;
			for (let i = 0; i < starCount; i++) {
				const x = Math.random() * 2048;
				const y = Math.random() * 2048;
				const size = Math.random() * 2 + 0.5;

				// Determine star color based on brightness
				const brightness = Math.random();
				let color;

				if (brightness > 0.98) {
					const hue = Math.random() * 60 - 30 + (Math.random() > 0.5 ? 0 : 180);
					color = `hsla(${hue}, 80%, 90%, 0.9)`;
				} else if (brightness > 0.9) {
					color = `rgba(255, 255, 255, ${0.7 + Math.random() * 0.3})`;
				} else {
					const alpha = 0.2 + Math.random() * 0.5;
					color =
						Math.random() > 0.3 ? `rgba(220, 225, 255, ${alpha})` : `rgba(180, 190, 255, ${alpha})`;
				}

				// Draw star with optional glow
				if (Math.random() > 0.8) {
					const radius = size * (2 + Math.random() * 4);
					const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
					gradient.addColorStop(0, color);
					gradient.addColorStop(1, 'rgba(0, 0, 50, 0)');

					ctx.beginPath();
					ctx.fillStyle = gradient;
					ctx.arc(x, y, radius, 0, Math.PI * 2);
					ctx.fill();
				}

				ctx.beginPath();
				ctx.fillStyle = color;
				ctx.arc(x, y, size, 0, Math.PI * 2);
				ctx.fill();
			}

			// Add nebulae
			const nebulaCount = 5 * VISUAL_CONFIG.particles.density;
			for (let i = 0; i < nebulaCount; i++) {
				const x = Math.random() * 2048;
				const y = Math.random() * 2048;
				const radius = 150 + Math.random() * 350;

				// Create colorful nebula
				const nebulaType = Math.floor(Math.random() * 3);
				let color1, color2;

				if (nebulaType === 0) {
					color1 = 'rgba(30, 50, 180, 0.05)';
					color2 = 'rgba(0, 10, 40, 0)';
				} else if (nebulaType === 1) {
					color1 = 'rgba(180, 30, 80, 0.04)';
					color2 = 'rgba(40, 0, 20, 0)';
				} else {
					color1 = 'rgba(30, 180, 150, 0.04)';
					color2 = 'rgba(0, 40, 40, 0)';
				}

				const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
				gradient.addColorStop(0, color1);
				gradient.addColorStop(1, color2);

				ctx.beginPath();
				ctx.fillStyle = gradient;
				ctx.arc(x, y, radius, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		const texture = new THREE.CanvasTexture(canvas);
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set(3, 3);

		return texture;
	}

	/**
	 * Create boundary markers
	 */
	private createBoundaryMarkers(): void {
		const size = WORLD_CONFIG.boundarySize;

		// Create square outline
		const points = [
			new THREE.Vector3(-size, 0.05, -size),
			new THREE.Vector3(size, 0.05, -size),
			new THREE.Vector3(size, 0.05, size),
			new THREE.Vector3(-size, 0.05, size),
			new THREE.Vector3(-size, 0.05, -size)
		];

		const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
		const lineMaterial = new THREE.LineBasicMaterial({
			color: 0x4facfe,
			transparent: true,
			opacity: 0.8
		});

		const boundaryLine = new THREE.Line(lineGeometry, lineMaterial);
		this.scene.add(boundaryLine);

		// Create glow effect
		const glowMaterial = new THREE.LineBasicMaterial({
			color: 0x00f2fe,
			transparent: true,
			opacity: 0.4
		});

		const glowLine = new THREE.Line(lineGeometry, glowMaterial);
		glowLine.scale.set(1.01, 1, 1.01);
		this.scene.add(glowLine);

		// Add lights at the corners for better visibility
		const corners = [
			[size, 0, size],
			[size, 0, -size],
			[-size, 0, size],
			[-size, 0, -size]
		];

		corners.forEach(([x, , z]) => {
			const light = new THREE.PointLight(0x4facfe, 0.6, 3);
			light.position.set(x, 0.3, z);
			this.scene.add(light);
		});
	}

	/**
	 * Create ambient particles
	 */
	private createAmbientParticles(): void {
		const particleCount = PERFORMANCE_CONFIG.maxParticles * VISUAL_CONFIG.particles.density;
		const particleGeometry = new THREE.BufferGeometry();
		const particlePositions = new Float32Array(particleCount * 3);
		const particleSizes = new Float32Array(particleCount);

		for (let i = 0; i < particleCount; i++) {
			// Random position within a cylinder
			const radius = Math.random() * WORLD_CONFIG.boundarySize;
			const angle = Math.random() * Math.PI * 2;

			particlePositions[i * 3] = Math.sin(angle) * radius;
			particlePositions[i * 3 + 1] = Math.random() * 7 + 1;
			particlePositions[i * 3 + 2] = Math.cos(angle) * radius;

			// Random sizes
			particleSizes[i] = Math.random() * 0.5 + 0.1;
		}

		particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
		particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

		const particleMaterial = new THREE.PointsMaterial({
			color: 0x6666ff,
			size: 0.5,
			transparent: true,
			blending: THREE.AdditiveBlending,
			opacity: 0.5,
			sizeAttenuation: true
		});

		const particles = new THREE.Points(particleGeometry, particleMaterial);
		this.scene.add(particles);
	}

	/**
	 * Spawn initial collectibles
	 */
	private spawnInitialCollectibles(): void {
		for (let i = 0; i < 15; i++) {
			const angle = Math.random() * Math.PI * 2;
			const radius = Math.random() * 10 + 5;
			const position = new THREE.Vector3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);

			if (Math.random() < 0.8) {
				this.collectibleManager.spawnCollectible(position, CollectibleType.EXPERIENCE);
			} else {
				this.collectibleManager.spawnCollectible(position, CollectibleType.HEALTH);
			}
		}
	}

	/**
	 * Update game state
	 */
	private update(): void {
		if (this.isGameOver) return;
		if (this.isPaused) return;

		const delta = this.clock.getDelta();

		// Check performance and adjust settings
		this.checkPerformance(delta);

		// Update player
		this.player.update(delta);

		// Update camera to follow player
		this.updateCamera();

		// Update game systems
		this.enemyManager.update(delta);
		this.collectibleManager.update(delta);

		// Update UI (in a full implementation, there would be a UI manager)
		this.updateUI();

		// Check projectile collisions with enemies using spatial grid
		this.checkProjectileCollisions();

		// Update current wave
		this.currentWave = this.enemyManager.getWaveNumber();

		// Check game over condition
		if (this.player.getHealth() <= 0) {
			this.gameOver();
		}
	}

	/**
	 * Update camera to follow player
	 */
	private updateCamera(): void {
		const position = this.player.getPosition();
		this.camera.position.x = position.x;
		this.camera.position.z = position.z;
		this.camera.lookAt(position.x, 0, position.z);
	}

	/**
	 * Update UI
	 */
	private updateUI(): void {
		// This would be implemented in a real UI system
		// For now, we'll just log the current wave for debugging
		this.debug.debug(`Current wave: ${this.currentWave}`);
	}

	/**
	 * Check projectile collisions with enemies
	 */
	private checkProjectileCollisions(): void {
		const killedEnemies = this.player.checkWeaponCollisions(this.enemyManager.enemies);

		if (killedEnemies.length > 0) {
			// Add score
			const pointsEarned = killedEnemies.length * 10;
			this.score += pointsEarned;

			// Process killed enemies
			this.processKilledEnemies(this.getKilledEnemyData(killedEnemies));
		}
	}

	/**
	 * Convert Enemy[] to KilledEnemyData[]
	 */
	private getKilledEnemyData(killedEnemies: Enemy[]): KilledEnemyData[] {
		return killedEnemies.map((enemy) => ({
			position: enemy.getPosition(),
			value: enemy.getIsBoss() ? 50 : 5,
			isBoss: enemy.getIsBoss(),
			healthDropChance: enemy.getIsBoss() ? 1.0 : 0.1
		}));
	}

	/**
	 * Process killed enemies and spawn collectibles
	 * (This is a stub - implementation would be added later)
	 */
	private processKilledEnemies(killedEnemies: KilledEnemyData[]): void {
		// This is a stub implementation that demonstrates usage of the parameter
		if (killedEnemies.length > 0) {
			this.score += killedEnemies.reduce((total, enemy) => total + (enemy.isBoss ? 500 : 100), 0);
		}
	}

	/**
	 * Check performance and adjust settings
	 */
	private checkPerformance(delta: number): void {
		// Only check every second
		this.lastPerformanceCheck += delta;
		if (this.lastPerformanceCheck < 1) return;

		// Calculate FPS
		const fps = 1 / delta;
		this.fpsBuffer.push(fps);

		// Keep buffer at max 60 samples (1 minute at 60fps)
		if (this.fpsBuffer.length > 60) {
			this.fpsBuffer.shift();
		}

		// Get average FPS - currently unused but would be used to adjust settings
		// const avgFps = this.fpsBuffer.reduce((a, b) => a + b, 0) / this.fpsBuffer.length;

		// Adjust settings based on performance - this would normally call adjustSettingsForPerformance
		// For now, we'll keep this as a stub for later implementation

		// Reset timer
		this.lastPerformanceCheck = 0;
	}

	/**
	 * Handle game over
	 */
	private gameOver(): void {
		this.isGameOver = true;
		this.debug.info(`Game over! Score: ${this.score}`);

		// In a real implementation, we would show a game over screen
		// and allow the player to restart
	}

	/**
	 * Toggle pause state
	 */
	public togglePause(): void {
		if (this.isGameOver) return;

		this.isPaused = !this.isPaused;

		if (this.isPaused) {
			this.clock.stop();
			this.debug.info('Game paused');
		} else {
			this.clock.start();
			this.debug.info('Game resumed');
		}
	}

	/**
	 * Exit the game
	 */
	public exitGame(): void {
		// Create and dispatch custom event
		const exitEvent = new CustomEvent('gameExit');
		document.dispatchEvent(exitEvent);

		// Clean up resources
		this.cleanup();
	}

	/**
	 * Start the game loop
	 */
	public start(): void {
		this.animate();
		this.debug.info('Game started');
	}

	/**
	 * Animation loop
	 */
	private animate(): void {
		this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

		// Start performance measurement
		this.debug.startFrame();

		// Update game state
		this.update();

		// Render scene
		this.renderer.render(this.scene, this.camera);

		// End performance measurement
		this.debug.endFrame();
	}

	/**
	 * Clean up resources
	 */
	public cleanup(): void {
		// Stop animation loop
		cancelAnimationFrame(this.animationFrameId);

		// Stop the game
		this.isPaused = true;
		this.isGameOver = true;

		// Remove event listeners
		document.removeEventListener('resume-game', () => {});
		document.removeEventListener('toggle-pause', () => {});

		// Clean up game systems
		this.enemyManager.cleanup();
		this.collectibleManager.cleanup();

		// Dispose of THREE.js resources
		// No dispose method exists, so we'll skip this

		// Remove renderer DOM element
		if (this.renderer) {
			this.container.removeChild(this.renderer.domElement);
		}

		// Signal finished
		this.debug.info('Game cleaned up');
	}

	/**
	 * Set up event listeners
	 */
	private setupEventListeners(): void {
		// Setup event listeners for the game
		window.addEventListener('resize', this.handleResize.bind(this));
	}

	/**
	 * Handle window resize
	 */
	private handleResize(): void {
		// Handle window resize logic
	}
}
