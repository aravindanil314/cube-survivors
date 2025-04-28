import * as THREE from 'three';
import { PlayerCharacter } from './PlayerCharacter';
import { EnemyManager } from './EnemyManager';
import { CollectibleManager } from './CollectibleManager';
import { CollectibleType } from './Collectible';
import { GameUI } from './GameUI';

export class Game {
	private container: HTMLElement;
	private scene: THREE.Scene;
	private camera!: THREE.OrthographicCamera;
	private renderer!: THREE.WebGLRenderer;
	private player!: PlayerCharacter;
	private floor!: THREE.Mesh;
	private clock: THREE.Clock;
	private keys: { [key: string]: boolean };
	private enemyManager!: EnemyManager;
	private collectibleManager!: CollectibleManager;
	private ui!: GameUI;
	private score: number = 0;
	private gameTime: number = 0;
	private isGameOver: boolean = false;
	private isPaused: boolean = false;
	private boundarySize: number = 20;
	private currentWave: number = 1;
	private particles: THREE.Points[] = [];
	private touchMovement: { x: number; z: number } = { x: 0, z: 0 };
	private isMobile: boolean = false;

	constructor(container: HTMLElement) {
		this.container = container;
		this.clock = new THREE.Clock();
		this.keys = {
			w: false,
			a: false,
			s: false,
			d: false
		};

		// Initialize properties
		this.scene = new THREE.Scene();

		// Check if on mobile device
		this.isMobile = window.innerWidth < 768;

		// Set up everything else
		this.init();
		this.setupInputHandlers();

		// Listen for resume game event from UI
		document.addEventListener('resume-game', () => {
			if (this.isPaused) {
				this.togglePause();
			}
		});

		// Listen for toggle pause event from pause button
		document.addEventListener('toggle-pause', () => {
			this.togglePause();
		});

		// Listen for touch movement events from the virtual joystick
		document.addEventListener('touch-move', ((e: Event) => {
			// Cast Event to CustomEvent to access detail property
			const customEvent = e as CustomEvent<{ x: number; z: number }>;
			// Update touch movement vector
			this.touchMovement = customEvent.detail;
		}) as EventListener);

		// Handle window resize to update isMobile flag
		window.addEventListener('resize', () => {
			this.isMobile = window.innerWidth < 768;
		});
	}

	private init(): void {
		// Create scene with a slightly blue-tinted background
		this.scene.background = new THREE.Color(0x0a0a1a);
		this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.035);

		// Camera - orthographic for top-down view
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

		// Renderer
		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit for performance
		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.container.appendChild(this.renderer.domElement);

		// Add lighting
		const ambientLight = new THREE.AmbientLight(0x404080, 2);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xaaccff, 1.2);
		directionalLight.position.set(5, 10, 7.5);
		directionalLight.castShadow = true;

		// Improve shadow quality
		directionalLight.shadow.mapSize.width = 1024;
		directionalLight.shadow.mapSize.height = 1024;
		directionalLight.shadow.camera.near = 0.5;
		directionalLight.shadow.camera.far = 50;
		directionalLight.shadow.bias = -0.0005;

		this.scene.add(directionalLight);

		// Add subtle blue point light for atmosphere
		const pointLight = new THREE.PointLight(0x3333ff, 0.8, 30);
		pointLight.position.set(0, 5, 0);
		this.scene.add(pointLight);

		// Create enhanced floor with grid texture
		const gridSize = 50;
		const gridDivisions = 50;

		// Create a more vibrant grid with glowing lines
		const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x4444bb, 0x222266);
		gridHelper.position.y = 0.01; // Slightly above floor to prevent z-fighting
		this.scene.add(gridHelper);

		// Create floor with gradient texture
		const floorGeometry = new THREE.PlaneGeometry(gridSize, gridSize, 32, 32);

		// Create radial gradient texture
		const floorCanvas = document.createElement('canvas');
		floorCanvas.width = 1024;
		floorCanvas.height = 1024;
		const floorCtx = floorCanvas.getContext('2d');

		if (floorCtx) {
			// Create radial gradient
			const gradient = floorCtx.createRadialGradient(
				512,
				512,
				0, // Inner circle (x, y, radius)
				512,
				512,
				512 // Outer circle (x, y, radius)
			);

			// Add gradient colors - deep blue to darker blue
			gradient.addColorStop(0, '#202060');
			gradient.addColorStop(0.5, '#151540');
			gradient.addColorStop(1, '#090920');

			// Fill with gradient
			floorCtx.fillStyle = gradient;
			floorCtx.fillRect(0, 0, 1024, 1024);

			// Add some noise for texture
			floorCtx.globalAlpha = 0.1;
			for (let i = 0; i < 20000; i++) {
				const x = Math.random() * 1024;
				const y = Math.random() * 1024;
				const size = Math.random() * 2 + 1;
				floorCtx.globalAlpha = Math.random() * 0.15;
				floorCtx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#3333ff';
				floorCtx.fillRect(x, y, size, size);
			}
		}

		// Create texture from canvas
		const floorTexture = new THREE.CanvasTexture(floorCanvas);
		floorTexture.wrapS = THREE.RepeatWrapping;
		floorTexture.wrapT = THREE.RepeatWrapping;

		// Create floor material with the texture
		const floorMaterial = new THREE.MeshStandardMaterial({
			map: floorTexture,
			roughness: 0.7,
			metalness: 0.3,
			color: 0xffffff
		});

		this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
		this.floor.rotation.x = -Math.PI / 2;
		this.floor.receiveShadow = true;
		this.scene.add(this.floor);

		// Create ambient particles for atmosphere
		this.createAmbientParticles();

		// Create player character with boundary limits
		this.player = new PlayerCharacter(this.scene, this.boundarySize);

		// Add boundary markers
		this.createBoundaryMarkers(this.boundarySize);

		// Create game systems
		this.enemyManager = new EnemyManager(this.scene, this.player, this.boundarySize);
		this.collectibleManager = new CollectibleManager(this.scene, this.player);

		// Create UI
		this.ui = new GameUI(this.container, this.player);
		this.ui.setWave(this.currentWave);

		// Handle window resize
		window.addEventListener('resize', this.handleResize.bind(this));

		// Spawn initial enemies without advancing the wave
		this.enemyManager.spawnInitialEnemies();

		// Spawn some initial collectibles
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

	private createAmbientParticles(): void {
		// Create floating particles for atmosphere
		const particleCount = 500;
		const particleGeometry = new THREE.BufferGeometry();
		const particlePositions = new Float32Array(particleCount * 3);
		const particleSizes = new Float32Array(particleCount);

		for (let i = 0; i < particleCount; i++) {
			// Random position within a cylinder shape
			const radius = Math.random() * this.boundarySize;
			const angle = Math.random() * Math.PI * 2;

			particlePositions[i * 3] = Math.sin(angle) * radius;
			particlePositions[i * 3 + 1] = Math.random() * 7 + 1; // Height between 1-8
			particlePositions[i * 3 + 2] = Math.cos(angle) * radius;

			// Random sizes
			particleSizes[i] = Math.random() * 0.5 + 0.1;
		}

		particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
		particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

		// Create glowing particle material
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
		this.particles.push(particles);
	}

	private createBoundaryMarkers(size: number): void {
		// Create more attractive boundary markers
		// Create glowing boundary edge
		const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(size * 2, 1, size * 2));

		const edgeMaterial = new THREE.LineBasicMaterial({
			color: 0x33ccff,
			transparent: true,
			opacity: 0.6,
			linewidth: 1
		});

		const boundaryEdges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
		boundaryEdges.position.y = 0.5;
		this.scene.add(boundaryEdges);

		// Create corner pillars
		const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
		const pillarMaterial = new THREE.MeshStandardMaterial({
			color: 0x3388ff,
			emissive: 0x1144aa,
			metalness: 0.8,
			roughness: 0.2
		});

		// Place pillars at corners
		const positions = [
			[size, 0, size],
			[size, 0, -size],
			[-size, 0, size],
			[-size, 0, -size]
		];

		positions.forEach((pos) => {
			const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
			pillar.position.set(pos[0], 1.5, pos[2]);
			pillar.castShadow = true;
			this.scene.add(pillar);

			// Add glowing ring at the top of each pillar
			const ringGeometry = new THREE.TorusGeometry(0.5, 0.1, 8, 24);
			const ringMaterial = new THREE.MeshBasicMaterial({
				color: 0x00ffff,
				transparent: true,
				opacity: 0.8
			});

			const ring = new THREE.Mesh(ringGeometry, ringMaterial);
			ring.position.set(pos[0], 3.2, pos[2]);
			ring.rotation.x = Math.PI / 2;
			this.scene.add(ring);
		});

		// Create boundary walls with translucent force field effect
		const wallHeight = 3;
		const wallOpacity = 0.15;

		// Create the four walls
		const wallGeometry = new THREE.PlaneGeometry(size * 2, wallHeight);
		const wallMaterial = new THREE.MeshBasicMaterial({
			color: 0x33ccff,
			transparent: true,
			opacity: wallOpacity,
			side: THREE.DoubleSide
		});

		// North wall
		const northWall = new THREE.Mesh(wallGeometry, wallMaterial);
		northWall.position.set(0, wallHeight / 2, size);
		northWall.rotation.y = Math.PI;
		this.scene.add(northWall);

		// South wall
		const southWall = new THREE.Mesh(wallGeometry, wallMaterial);
		southWall.position.set(0, wallHeight / 2, -size);
		this.scene.add(southWall);

		// East wall
		const eastWall = new THREE.Mesh(wallGeometry, wallMaterial);
		eastWall.position.set(size, wallHeight / 2, 0);
		eastWall.rotation.y = Math.PI / 2;
		this.scene.add(eastWall);

		// West wall
		const westWall = new THREE.Mesh(wallGeometry, wallMaterial);
		westWall.position.set(-size, wallHeight / 2, 0);
		westWall.rotation.y = -Math.PI / 2;
		this.scene.add(westWall);
	}

	private setupInputHandlers(): void {
		window.addEventListener('keydown', (event) => {
			const key = event.key.toLowerCase();
			if (key in this.keys) {
				this.keys[key] = true;
			}

			// Toggle pause on Escape key or 'p' key press
			if (key === 'escape' || key === 'p') {
				this.togglePause();
			}
		});

		window.addEventListener('keyup', (event) => {
			const key = event.key.toLowerCase();
			if (key in this.keys) {
				this.keys[key] = false;
			}
		});
	}

	private handleResize(): void {
		const aspectRatio = this.container.clientWidth / this.container.clientHeight;
		const viewSize = 15;

		this.camera.left = -viewSize * aspectRatio;
		this.camera.right = viewSize * aspectRatio;
		this.camera.top = viewSize;
		this.camera.bottom = -viewSize;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
	}

	public update(): void {
		if (this.isGameOver) return;
		if (this.isPaused) return; // Skip update if game is paused

		const delta = this.clock.getDelta();
		this.gameTime += delta;

		// Initialize movement vector
		const movement = {
			x: 0,
			z: 0
		};

		// Handle keyboard input for desktop
		if (this.keys.w) movement.z -= 1;
		if (this.keys.s) movement.z += 1;
		if (this.keys.a) movement.x -= 1;
		if (this.keys.d) movement.x += 1;

		// If touch input is active (on mobile), use that instead of keyboard
		if (this.isMobile || Math.abs(this.touchMovement.x) > 0 || Math.abs(this.touchMovement.z) > 0) {
			movement.x = this.touchMovement.x;
			movement.z = this.touchMovement.z;
		}

		// Normalize diagonal movement
		if (movement.x !== 0 && movement.z !== 0) {
			const length = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
			if (length > 0) {
				movement.x /= length;
				movement.z /= length;
			}
		}

		// Update player with movement vector
		this.player.update(delta, movement);

		// Update camera to follow player
		this.camera.position.x = this.player.getPosition().x;
		this.camera.position.z = this.player.getPosition().z;
		this.camera.lookAt(this.player.getPosition().x, 0, this.player.getPosition().z);

		// Update game systems
		this.enemyManager.update(delta);
		this.collectibleManager.update(delta);

		// Always update UI to reflect current player stats (including collected experience)
		this.ui.updateUI();

		// Always update wave UI
		this.currentWave = this.enemyManager.getWaveNumber();
		this.ui.setWave(this.currentWave);
		this.ui.updateWaveProgress(
			this.enemyManager.getWaveProgress(),
			this.enemyManager.getWaveTimeRemaining()
		);

		// Check projectile collisions with enemies
		// This now returns killed enemies instead of a score
		const killedEnemies = this.player.checkWeaponCollisions(this.enemyManager.enemies);

		// Process killed enemies
		if (killedEnemies.length > 0) {
			// Add score for each killed enemy
			const pointsEarned = killedEnemies.length * 10;
			this.score += pointsEarned;
			this.ui.addScore(pointsEarned);

			// Spawn collectibles at killed enemy positions
			killedEnemies.forEach((enemy) => {
				const position = enemy.getMesh().position.clone();

				// Always drop experience - now dropping multiple XP collectibles
				const xpAmount = enemy.getIsBoss() ? 10 : 2; // More XP from bosses, 2 from regular enemies

				for (let i = 0; i < xpAmount; i++) {
					// Add some spread to the collectibles
					const offset = new THREE.Vector3(
						(Math.random() - 0.5) * 1.5,
						0,
						(Math.random() - 0.5) * 1.5
					);
					this.collectibleManager.spawnCollectible(
						position.clone().add(offset),
						CollectibleType.EXPERIENCE
					);
				}

				// Check if should drop health based on enemy type's drop chance
				const healthDropChance = enemy.getHealthDropChance();
				if (Math.random() < healthDropChance) {
					this.collectibleManager.spawnCollectible(position, CollectibleType.HEALTH);
				}
			});
		}

		// Update particle animations
		this.particles.forEach((particleSystem) => {
			const positions = particleSystem.geometry.attributes.position.array;

			for (let i = 0; i < positions.length; i += 3) {
				// Gentle floating motion
				positions[i + 1] += Math.sin(this.gameTime + i) * 0.002;

				// Reset particles that drift too high or too low
				if (positions[i + 1] > 9) positions[i + 1] = 1;
				if (positions[i + 1] < 0.5) positions[i + 1] = 8;
			}

			particleSystem.geometry.attributes.position.needsUpdate = true;

			// Slowly rotate particle system
			particleSystem.rotation.y += delta * 0.05;
		});

		// Check if player is still alive or if game is won
		if (this.player.getHealth() <= 0) {
			this.gameOver();
		} else if (this.enemyManager.isGameWon()) {
			// Don't call gameOver, as EnemyManager handles the victory screen
		}
	}

	private gameOver(): void {
		this.isGameOver = true;
		this.ui.showGameOver(this.score);
	}

	public start(): void {
		this.animate();
	}

	private animate(): void {
		requestAnimationFrame(this.animate.bind(this));
		this.update();
		this.renderer.render(this.scene, this.camera);
	}

	public cleanup(): void {
		// Remove event listeners
		window.removeEventListener('resize', this.handleResize.bind(this));

		// Remove all event listeners on game elements
		window.removeEventListener('keydown', () => {});
		window.removeEventListener('keyup', () => {});

		// Clean up THREE.js resources
		this.renderer.dispose();

		// Remove the canvas from the DOM
		if (this.renderer.domElement.parentNode) {
			this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
		}
	}

	public handleContainerResize(): void {
		this.handleResize();
	}

	public togglePause(): void {
		// Don't allow pausing if game is over
		if (this.isGameOver) return;

		this.isPaused = !this.isPaused;

		if (this.isPaused) {
			this.clock.stop(); // Stop the clock to prevent delta time accumulation
			this.ui.showPauseScreen();
		} else {
			this.clock.start(); // Restart the clock
			this.ui.hidePauseScreen();
		}
	}
}
