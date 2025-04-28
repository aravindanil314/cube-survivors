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
	private particles: THREE.Object3D[] = [];
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

		// Listen for exit game event from pause menu
		document.addEventListener('exit-game', () => {
			this.exitGame();
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
		// Create scene with a deep space background
		this.scene.background = new THREE.Color(0x050510);
		this.scene.fog = new THREE.FogExp2(0x050510, 0.02);

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

		// Create a much larger cosmic floor
		const floorSize = 200; // Much larger than the play area
		const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize, 32, 32);

		// Create cosmic texture
		const floorCanvas = document.createElement('canvas');
		floorCanvas.width = 2048;
		floorCanvas.height = 2048;
		const floorCtx = floorCanvas.getContext('2d');

		if (floorCtx) {
			// Fill with deep space color
			floorCtx.fillStyle = '#050510';
			floorCtx.fillRect(0, 0, 2048, 2048);

			// Create a field of stars with different sizes and colors
			for (let i = 0; i < 3000; i++) {
				const x = Math.random() * 2048;
				const y = Math.random() * 2048;
				const size = Math.random() * 2 + 0.5;

				// Determine the star brightness/color
				const brightness = Math.random();
				let color;

				if (brightness > 0.98) {
					// Brightest stars with a slight color tint
					const hue = Math.random() * 60 - 30 + (Math.random() > 0.5 ? 0 : 180); // Blues and yellows
					color = `hsla(${hue}, 80%, 90%, 0.9)`;
				} else if (brightness > 0.9) {
					// Bright white stars
					color = `rgba(255, 255, 255, ${0.7 + Math.random() * 0.3})`;
				} else {
					// Dimmer stars in blue/white tones
					const alpha = 0.2 + Math.random() * 0.5;
					color =
						Math.random() > 0.3 ? `rgba(220, 225, 255, ${alpha})` : `rgba(180, 190, 255, ${alpha})`;
				}

				// Create a glowing effect for stars
				const glow = Math.random() > 0.8;

				if (glow) {
					const radius = size * (2 + Math.random() * 4);
					const gradient = floorCtx.createRadialGradient(x, y, 0, x, y, radius);
					gradient.addColorStop(0, color);
					gradient.addColorStop(1, 'rgba(0, 0, 50, 0)');

					floorCtx.beginPath();
					floorCtx.fillStyle = gradient;
					floorCtx.arc(x, y, radius, 0, Math.PI * 2);
					floorCtx.fill();
				}

				// Draw the star
				floorCtx.beginPath();
				floorCtx.fillStyle = color;
				floorCtx.arc(x, y, size, 0, Math.PI * 2);
				floorCtx.fill();
			}

			// Add a few larger nebula-like features
			for (let i = 0; i < 5; i++) {
				const x = Math.random() * 2048;
				const y = Math.random() * 2048;
				const radius = 150 + Math.random() * 350;

				// Create a colorful nebula
				const nebulaType = Math.floor(Math.random() * 3);
				let color1, color2;

				if (nebulaType === 0) {
					// Blueish nebula
					color1 = 'rgba(30, 50, 180, 0.05)';
					color2 = 'rgba(0, 10, 40, 0)';
				} else if (nebulaType === 1) {
					// Reddish nebula
					color1 = 'rgba(180, 30, 80, 0.04)';
					color2 = 'rgba(40, 0, 20, 0)';
				} else {
					// Greenish/teal nebula
					color1 = 'rgba(30, 180, 150, 0.04)';
					color2 = 'rgba(0, 40, 40, 0)';
				}

				const gradient = floorCtx.createRadialGradient(x, y, 0, x, y, radius);
				gradient.addColorStop(0, color1);
				gradient.addColorStop(1, color2);

				floorCtx.beginPath();
				floorCtx.fillStyle = gradient;
				floorCtx.arc(x, y, radius, 0, Math.PI * 2);
				floorCtx.fill();
			}
		}

		// Create texture from canvas
		const floorTexture = new THREE.CanvasTexture(floorCanvas);
		floorTexture.wrapS = THREE.RepeatWrapping;
		floorTexture.wrapT = THREE.RepeatWrapping;
		floorTexture.repeat.set(3, 3); // Repeat the texture for more stars

		// Create floor material with the texture
		const floorMaterial = new THREE.MeshStandardMaterial({
			map: floorTexture,
			roughness: 0.7,
			metalness: 0.2,
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
		// Create a simple square boundary line with a glow effect

		// Create square outline using line segments
		const squarePoints = [
			new THREE.Vector3(-size, 0.05, -size),
			new THREE.Vector3(size, 0.05, -size),
			new THREE.Vector3(size, 0.05, size),
			new THREE.Vector3(-size, 0.05, size),
			new THREE.Vector3(-size, 0.05, -size)
		];

		// Create the main geometry for the boundary line
		const lineGeometry = new THREE.BufferGeometry().setFromPoints(squarePoints);
		const lineMaterial = new THREE.LineBasicMaterial({
			color: 0x4facfe,
			transparent: true,
			opacity: 0.8,
			linewidth: 2
		});

		const boundaryLine = new THREE.Line(lineGeometry, lineMaterial);
		this.scene.add(boundaryLine);

		// Create a wider, more transparent line for the glow effect
		const glowMaterial = new THREE.LineBasicMaterial({
			color: 0x00f2fe,
			transparent: true,
			opacity: 0.4,
			linewidth: 1
		});

		const glowLine = new THREE.Line(lineGeometry, glowMaterial);
		glowLine.scale.set(1.01, 1, 1.01); // Slightly larger
		this.scene.add(glowLine);

		// Create a pulsing effect for the glow
		glowLine.userData.creationTime = this.gameTime;
		this.particles.push(glowLine);

		// Add small corner markers at the four corners
		const cornerPositions = [
			[-size, 0, -size],
			[size, 0, -size],
			[size, 0, size],
			[-size, 0, size]
		];

		cornerPositions.forEach((pos) => {
			// Add a small point light at each corner
			const cornerLight = new THREE.PointLight(0x4facfe, 0.6, 3);
			cornerLight.position.set(pos[0], 0.3, pos[2]);
			cornerLight.userData.creationTime = this.gameTime;
			this.scene.add(cornerLight);
			this.particles.push(cornerLight);

			// Add a small glowing marker at each corner
			const markerGeometry = new THREE.SphereGeometry(0.2, 16, 16);
			const markerMaterial = new THREE.MeshBasicMaterial({
				color: 0x4facfe,
				transparent: true,
				opacity: 0.7
			});

			const marker = new THREE.Mesh(markerGeometry, markerMaterial);
			marker.position.set(pos[0], 0.1, pos[2]);
			marker.userData.creationTime = this.gameTime;
			this.scene.add(marker);
			this.particles.push(marker);
		});
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
		this.particles.forEach((object) => {
			// Check if it's part of the boundary marker elements
			if (object.userData.creationTime !== undefined) {
				const timeSinceCreation = this.gameTime - object.userData.creationTime;

				// Handle different types of boundary elements
				if (object instanceof THREE.Line) {
					// Animate boundary line glow
					const material = object.material as THREE.LineBasicMaterial;
					material.opacity = 0.2 + Math.sin(timeSinceCreation * 1.5) * 0.3;
				} else if (object instanceof THREE.PointLight) {
					// Animate corner light intensity
					object.intensity = 0.4 + Math.sin(timeSinceCreation * 2) * 0.3;
				} else if (
					object instanceof THREE.Mesh &&
					object.geometry instanceof THREE.SphereGeometry
				) {
					// Animate corner marker opacity
					const material = object.material as THREE.MeshBasicMaterial;
					material.opacity = 0.4 + Math.sin(timeSinceCreation * 2) * 0.4;
				} else if (object instanceof THREE.Mesh && object.geometry instanceof THREE.RingGeometry) {
					// Backwards compatibility with any remaining ring geometries
					const material = object.material as THREE.MeshBasicMaterial;
					material.opacity = 0.2 + Math.sin(timeSinceCreation * 2) * 0.3;
				}
			} else if (object instanceof THREE.Points) {
				// Handle regular particles (stars)
				const positions = object.geometry.attributes.position.array;

				for (let i = 0; i < positions.length; i += 3) {
					// Gentle floating motion
					positions[i + 1] += Math.sin(this.gameTime + i) * 0.002;

					// Reset particles that drift too high or too low
					if (positions[i + 1] > 9) positions[i + 1] = 1;
					if (positions[i + 1] < 0.5) positions[i + 1] = 8;
				}

				object.geometry.attributes.position.needsUpdate = true;

				// Slowly rotate particle system
				object.rotation.y += delta * 0.05;
			}
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

	public exitGame(): void {
		// Create and dispatch a custom event to exit back to the start page
		const exitEvent = new CustomEvent('gameExit');
		document.dispatchEvent(exitEvent);

		// Clean up resources
		this.cleanup();
	}

	public cleanup(): void {
		// Stop the game loop
		this.isPaused = true;
		this.isGameOver = true;

		// Remove event listeners
		document.removeEventListener('resume-game', () => {});
		document.removeEventListener('toggle-pause', () => {});
		document.removeEventListener('exit-game', () => {});

		// Remove the touch-move event listener
		document.removeEventListener('touch-move', () => {});

		// Remove input handlers
		window.removeEventListener('resize', this.handleResize.bind(this));

		// Dispose of THREE.js resources
		this.renderer.dispose();

		// Remove canvas from container
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
