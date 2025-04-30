import * as THREE from 'three';
import { PlayerCharacter } from './PlayerCharacter';
import { EnemyManager } from './EnemyManager';
import { ProjectilePool } from './utils/ProjectilePool';

export enum EnemyType {
	MELEE = 'melee',
	RANGED = 'ranged',
	SPLITTING_MELEE = 'splitting_melee',
	AOE_RANGED = 'aoe_ranged',
	BOSS = 'boss'
}

export abstract class Enemy {
	public mesh: THREE.Group;
	protected scene: THREE.Scene;
	protected target: PlayerCharacter;
	protected speed: number;
	protected health: number;
	protected maxHealth: number;
	public isDead: boolean = false;
	protected moveDirection: THREE.Vector3 = new THREE.Vector3();
	protected type: EnemyType;
	protected healthDropChance: number = 0.1; // Default health drop chance
	protected isBoss: boolean = false;
	protected healthBarContainer!: THREE.Group;
	protected healthBarBackground!: THREE.Mesh;
	protected healthBarFill!: THREE.Mesh;
	protected waveNumber: number = 1; // Track current wave
	protected collisionRadius: number = 0.7; // Radius for collision detection
	protected velocity: THREE.Vector3 = new THREE.Vector3();

	constructor(
		scene: THREE.Scene,
		position: THREE.Vector3,
		target: PlayerCharacter,
		type: EnemyType,
		speed: number,
		health: number,
		waveNumber: number = 1
	) {
		this.scene = scene;
		this.target = target;
		this.speed = speed * (1 + (waveNumber - 1) * 0.1); // Increase speed with wave
		this.waveNumber = waveNumber;

		// Scale health with wave number
		const healthMultiplier = 1 + (waveNumber - 1) * 0.2; // 20% more health per wave
		this.health = health * healthMultiplier;
		this.maxHealth = this.health;

		this.type = type;
		this.mesh = this.createMesh();
		this.mesh.position.copy(position);
		this.scene.add(this.mesh);

		// Create health bar
		this.healthBarContainer = this.createHealthBar();
		this.mesh.add(this.healthBarContainer);
	}

	protected abstract createMesh(): THREE.Group;

	protected createHealthBar(): THREE.Group {
		const healthBarGroup = new THREE.Group();

		// Position above the enemy
		healthBarGroup.position.y = 1.2;

		// Background of health bar (dark gray/black)
		const backgroundGeometry = new THREE.PlaneGeometry(1, 0.1);
		const backgroundMaterial = new THREE.MeshBasicMaterial({
			color: 0x222222,
			side: THREE.DoubleSide
		});
		this.healthBarBackground = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
		healthBarGroup.add(this.healthBarBackground);

		// Foreground of health bar (bright cyan blue)
		const fillGeometry = new THREE.PlaneGeometry(1, 0.1);
		const fillMaterial = new THREE.MeshBasicMaterial({
			color: 0x00ffff,
			side: THREE.DoubleSide
		});
		this.healthBarFill = new THREE.Mesh(fillGeometry, fillMaterial);

		// Position the fill bar slightly in front of the background
		this.healthBarFill.position.z = 0.01;

		// Set the origin to the left side for easier scaling
		this.healthBarFill.geometry.translate(0.5, 0, 0);
		this.healthBarFill.position.x = -0.5;

		healthBarGroup.add(this.healthBarFill);

		// Make health bar always face the camera
		healthBarGroup.rotation.x = Math.PI / 2;

		return healthBarGroup;
	}

	protected updateHealthBar(): void {
		if (this.isDead) return;

		// Calculate health percentage
		const healthPercent = Math.max(0, this.health / this.maxHealth);

		// Update the fill bar scale
		this.healthBarFill.scale.x = healthPercent;

		// Make health bar face the camera
		const camera = this.scene.getObjectByProperty(
			'type',
			'OrthographicCamera'
		) as THREE.OrthographicCamera;
		if (camera) {
			this.healthBarContainer.lookAt(camera.position);
		}

		// Hide health bar when full health
		if (healthPercent >= 1) {
			this.healthBarContainer.visible = false;
		} else {
			this.healthBarContainer.visible = true;
		}
	}

	public update(delta: number): void {
		if (this.isDead) return;

		this.updateMovement(delta);
		this.updateAttack(delta);
		this.updateHealthBar();
	}

	protected updateMovement(delta: number): void {
		// Calculate direction to player
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position).normalize();

		// Set base velocity towards player
		this.velocity.copy(this.moveDirection).multiplyScalar(this.speed * delta);

		// Apply collision avoidance with other enemies
		this.avoidOtherEnemies(delta);

		// Apply collision with player
		this.handlePlayerCollision(delta);

		// Apply final velocity
		this.mesh.position.add(this.velocity);

		// Rotate to face movement direction (not necessarily directly at player due to collisions)
		if (this.velocity.length() > 0.001) {
			const angle = Math.atan2(this.velocity.x, this.velocity.z);
			// Smooth rotation
			const currentAngle = this.mesh.rotation.y;
			const angleDiff = ((angle - currentAngle + Math.PI) % (Math.PI * 2)) - Math.PI;
			this.mesh.rotation.y += angleDiff * 0.1;
		}
	}

	protected avoidOtherEnemies(delta: number): void {
		// Get all enemies from the scene
		const enemiesInScene = this.getAllEnemiesInScene();

		// Check distance to other enemies
		for (const otherEnemy of enemiesInScene) {
			if (otherEnemy === this || otherEnemy.isDead) continue;

			// Optimization: Skip collision checking for enemies that are far away
			// Quick check using Manhattan distance first (cheaper than full distance calculation)
			const dx = Math.abs(this.mesh.position.x - otherEnemy.mesh.position.x);
			const dz = Math.abs(this.mesh.position.z - otherEnemy.mesh.position.z);

			// If enemies are clearly too far on either axis, skip the full check
			if (dx > 2 || dz > 2) continue;

			// Only now do the more expensive full distance calculation
			const distance = this.mesh.position.distanceTo(otherEnemy.mesh.position);
			const minDistance = this.collisionRadius + otherEnemy.collisionRadius;

			if (distance < minDistance) {
				// Calculate repulsion direction
				const repulsionDir = new THREE.Vector3()
					.subVectors(this.mesh.position, otherEnemy.mesh.position)
					.normalize();

				// Strength is stronger the closer they are
				const strength = (minDistance - distance) / minDistance;

				// Apply repulsion force
				const repulsionForce = repulsionDir.multiplyScalar(strength * this.speed * delta * 2);
				this.velocity.add(repulsionForce);

				// If enemies are really overlapping, push them apart more forcefully
				if (distance < minDistance * 0.5) {
					this.mesh.position.add(repulsionDir.multiplyScalar(0.05));
				}
			}
		}
	}

	protected handlePlayerCollision(delta: number): void {
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());
		const minDistance = this.collisionRadius + 0.5; // Player radius estimated at 0.5

		if (distanceToPlayer < minDistance) {
			// Calculate bounce direction
			const bounceDir = new THREE.Vector3()
				.subVectors(this.mesh.position, this.target.getPosition())
				.normalize();

			// Apply bounce force
			const bounceForce = bounceDir.multiplyScalar(this.speed * delta * 1.5);
			this.velocity.add(bounceForce);

			// For bosses, apply less bounce
			if (this.isBoss) {
				this.velocity.multiplyScalar(0.7);
			}
		}
	}

	protected getAllEnemiesInScene(): Enemy[] {
		// This method needs to be initialized with the list of enemies during update
		// It will be properly set by the EnemyManager
		return EnemyManager.getInstance().getEnemies();
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	protected updateAttack(delta: number): void {
		// To be implemented by subclasses
	}

	public takeDamage(amount: number): void {
		this.health -= amount;

		// Flash enemy white when taking damage
		const bodyMesh = this.mesh.children[0] as THREE.Mesh;
		const originalMaterial = bodyMesh.material as THREE.MeshStandardMaterial;
		const flashMaterial = originalMaterial.clone();
		flashMaterial.color.set(0xffffff);
		bodyMesh.material = flashMaterial;

		setTimeout(() => {
			if (!this.isDead) {
				bodyMesh.material = originalMaterial;
			}
		}, 100);

		// Check if enemy should die
		if (this.health <= 0 && !this.isDead) {
			this.die();
		}
	}

	public die(): void {
		this.isDead = true;
		this.scene.remove(this.mesh);
	}

	public getPosition(): THREE.Vector3 {
		return this.mesh.position;
	}

	public getMesh(): THREE.Group {
		return this.mesh;
	}

	public getType(): EnemyType {
		return this.type;
	}

	public getHealthDropChance(): number {
		return this.healthDropChance;
	}

	public getIsBoss(): boolean {
		return this.isBoss;
	}

	public getMaxHealth(): number {
		return this.maxHealth;
	}

	public cleanup(): void {
		this.scene.remove(this.mesh);
	}
}

export class MeleeEnemy extends Enemy {
	private attackCooldown: number = 0;
	private readonly attackRange: number = 1.2;

	constructor(
		scene: THREE.Scene,
		position: THREE.Vector3,
		target: PlayerCharacter,
		waveNumber: number = 1
	) {
		super(scene, position, target, EnemyType.MELEE, 3.0, 20, waveNumber);
		this.healthDropChance = 0.15; // 15% chance to drop health
		this.collisionRadius = 0.6; // Slightly smaller collision for melee enemies
	}

	protected createMesh(): THREE.Group {
		// Create a green cube for melee enemies
		const enemyGroup = new THREE.Group();

		// Body
		const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);
		const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x22cc22 });
		const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
		bodyMesh.position.y = 0.5;
		enemyGroup.add(bodyMesh);

		// Spikes - make it look more aggressive
		const spikeGeometry = new THREE.ConeGeometry(0.2, 0.4, 4);
		const spikeMaterial = new THREE.MeshLambertMaterial({ color: 0x118811 });

		// Add spikes around the body
		for (let i = 0; i < 4; i++) {
			const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
			spike.position.set(
				Math.cos((i / 4) * Math.PI * 2) * 0.7,
				0.5,
				Math.sin((i / 4) * Math.PI * 2) * 0.7
			);
			spike.rotation.x = Math.PI / 2;
			spike.rotation.z = (i / 4) * Math.PI * 2;
			enemyGroup.add(spike);
		}

		return enemyGroup;
	}

	public updateAttack(delta: number): void {
		// Decrement attack cooldown
		if (this.attackCooldown > 0) {
			this.attackCooldown -= delta;
		}

		// Calculate distance to player
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());

		// Attack if in range and cooldown is ready
		if (distanceToPlayer <= this.attackRange && this.attackCooldown <= 0) {
			// Apply damage to player (reduced from 3 to 2)
			this.target.takeDamage(2);

			// Show attack animation
			this.showAttackAnimation();

			// Reset attack cooldown (1 second)
			this.attackCooldown = 1.0;
		}
	}

	private showAttackAnimation(): void {
		// Simple attack animation - scale up and down quickly
		const originalScale = this.mesh.scale.clone();
		const scaleFactor = 1.3;

		// Scale up
		this.mesh.scale.set(
			originalScale.x * scaleFactor,
			originalScale.y * scaleFactor,
			originalScale.z * scaleFactor
		);

		// Scale back down after a short delay
		setTimeout(() => {
			if (!this.isDead) {
				this.mesh.scale.copy(originalScale);
			}
		}, 100);
	}
}

export class SplittingMeleeEnemy extends Enemy {
	private attackCooldown: number = 0;
	private readonly attackRange: number = 1.2;
	private hasSplit: boolean = false;

	constructor(
		scene: THREE.Scene,
		position: THREE.Vector3,
		target: PlayerCharacter,
		waveNumber: number = 1
	) {
		// Stronger than regular melee enemies but reduced stats
		super(scene, position, target, EnemyType.SPLITTING_MELEE, 2.8, 30, waveNumber);
		this.healthDropChance = 0.2; // Higher chance to drop health
		this.collisionRadius = 0.7; // Slightly larger collision
	}

	protected createMesh(): THREE.Group {
		// Create a darker green cube with red spikes for splitting melee enemies
		const enemyGroup = new THREE.Group();

		// Body - darker green
		const bodyGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
		const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x228822 });
		const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
		bodyMesh.position.y = 0.6;
		enemyGroup.add(bodyMesh);

		// Spikes - red
		const spikeGeometry = new THREE.ConeGeometry(0.25, 0.5, 4);
		const spikeMaterial = new THREE.MeshLambertMaterial({ color: 0xcc3322 });

		// Add spikes around the body
		for (let i = 0; i < 6; i++) {
			const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
			spike.position.set(
				Math.cos((i / 6) * Math.PI * 2) * 0.8,
				0.6,
				Math.sin((i / 6) * Math.PI * 2) * 0.8
			);
			spike.rotation.x = Math.PI / 2;
			spike.rotation.z = (i / 6) * Math.PI * 2;
			enemyGroup.add(spike);
		}

		return enemyGroup;
	}

	public updateAttack(delta: number): void {
		// Decrement attack cooldown
		if (this.attackCooldown > 0) {
			this.attackCooldown -= delta;
		}

		// Calculate distance to player
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());

		// Attack if in range and cooldown is ready
		if (distanceToPlayer <= this.attackRange && this.attackCooldown <= 0) {
			// Apply damage to player - reduced from 4 to 3
			this.target.takeDamage(3);

			// Show attack animation
			this.showAttackAnimation();

			// Reset attack cooldown (increased from 0.9 to 1.2 seconds)
			this.attackCooldown = 1.2;
		}
	}

	private showAttackAnimation(): void {
		// Attack animation - pulse and glow
		const originalScale = this.mesh.scale.clone();
		const scaleFactor = 1.4;

		// Scale up
		this.mesh.scale.set(
			originalScale.x * scaleFactor,
			originalScale.y * scaleFactor,
			originalScale.z * scaleFactor
		);

		// Scale back down after a short delay
		setTimeout(() => {
			if (!this.isDead) {
				this.mesh.scale.copy(originalScale);
			}
		}, 120);
	}

	// Override the die method to spawn two regular melee enemies
	public die(): void {
		// Only split once (to prevent infinite splitting if the spawned enemies also split)
		if (!this.hasSplit) {
			this.hasSplit = true;

			// Spawn two regular melee enemies at this location
			const position = this.mesh.position.clone();
			const enemyManager = EnemyManager.getInstance();

			// Create slight offset positions
			const offset1 = new THREE.Vector3(0.5, 0, 0.5);
			const offset2 = new THREE.Vector3(-0.5, 0, -0.5);

			// Spawn the two melee enemies with half the health of this enemy
			const enemy1 = new MeleeEnemy(
				this.scene,
				position.clone().add(offset1),
				this.target,
				this.waveNumber
			);
			const enemy2 = new MeleeEnemy(
				this.scene,
				position.clone().add(offset2),
				this.target,
				this.waveNumber
			);

			// Set lower health for the spawned enemies (75% damage instead of 50%)
			enemy1.takeDamage(enemy1.getMaxHealth() * 0.75);
			enemy2.takeDamage(enemy2.getMaxHealth() * 0.75);

			// Add them to the enemy manager
			enemyManager.addEnemy(enemy1);
			enemyManager.addEnemy(enemy2);

			// Visual effect for splitting
			this.createSplitEffect();
		}

		// Call the parent die method to handle standard death logic
		super.die();
	}

	private createSplitEffect(): void {
		// Create a visual effect when the enemy splits
		const ringGeometry = new THREE.RingGeometry(0, 2, 32);
		ringGeometry.rotateX(Math.PI / 2);

		const ringMaterial = new THREE.MeshBasicMaterial({
			color: 0x22ff22,
			transparent: true,
			opacity: 0.7,
			side: THREE.DoubleSide
		});

		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.position.copy(this.mesh.position);
		ring.position.y = 0.1;
		this.scene.add(ring);

		// Animate the split effect
		const startTime = Date.now();
		const animate = () => {
			const elapsed = (Date.now() - startTime) / 1000;
			const scale = 1 + elapsed * 3;

			if (elapsed < 0.5) {
				ring.scale.set(scale, scale, scale);
				ring.material.opacity = 0.7 * (1 - elapsed * 2);
				requestAnimationFrame(animate);
			} else {
				this.scene.remove(ring);
			}
		};

		animate();
	}
}

export class RangedEnemy extends Enemy {
	private shootCooldown: number = 0;
	private readonly preferredDistance: number = 8; // Distance they try to maintain from player
	private readonly shootRange: number = 12; // Max range they can shoot from
	private projectilePool: ProjectilePool;
	private debug: boolean = false; // Debug logs disabled in production
	private projectiles: THREE.Mesh[] = []; // Direct array of active projectiles

	constructor(
		scene: THREE.Scene,
		position: THREE.Vector3,
		target: PlayerCharacter,
		waveNumber: number = 1
	) {
		super(scene, position, target, EnemyType.RANGED, 1.4 + Math.random() * 0.3, 2, waveNumber);
		this.healthDropChance = 0.2; // 20% chance to drop health
		this.collisionRadius = 0.55; // Slightly smaller collision for ranged enemies

		// Get the projectile pool instance - crucial for projectile management
		this.projectilePool = ProjectilePool.getInstance(scene);

		// Removed debug logging for projectile pool initialization
	}

	protected createMesh(): THREE.Group {
		const group = new THREE.Group();

		// Simplified enemy body with high-contrast colors for visibility
		const bodyGeometry = new THREE.SphereGeometry(0.35, 8, 8);
		const bodyMaterial = new THREE.MeshBasicMaterial({
			color: 0xff00ff, // Bright magenta for better visibility
			transparent: true,
			opacity: 1.0 // Full opacity for better visibility
		});
		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		body.position.y = 0.35;
		group.add(body);

		// Single ring for visual distinction
		const ringGeometry = new THREE.TorusGeometry(0.5, 0.04, 4, 16);
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: 0xffff00, // Yellow for contrast
			transparent: true,
			opacity: 0.9
		});

		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.position.y = 0.35;
		group.add(ring);

		return group;
	}

	protected updateMovement(delta: number): void {
		// Calculate direction and distance to player
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position);
		const distanceToPlayer = this.moveDirection.length();
		this.moveDirection.normalize();

		// Set base velocity based on preferred distance
		if (distanceToPlayer < this.preferredDistance - 1) {
			// Too close to player, move away
			this.velocity.copy(this.moveDirection).multiplyScalar(-this.speed * delta);
		} else if (distanceToPlayer > this.preferredDistance + 1) {
			// Too far from player, move closer
			this.velocity.copy(this.moveDirection).multiplyScalar(this.speed * delta);
		} else {
			// At good distance, strafe sideways
			const strafeDir = new THREE.Vector3(-this.moveDirection.z, 0, this.moveDirection.x);
			strafeDir.multiplyScalar(Math.sin(Date.now() * 0.001) * this.speed * delta);
			this.velocity.copy(strafeDir);
		}

		// Apply collision avoidance with other enemies
		this.avoidOtherEnemies(delta);

		// Apply collision with player
		this.handlePlayerCollision(delta);

		// Apply final velocity
		this.mesh.position.add(this.velocity);

		// Always face player regardless of actual movement direction
		const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
		// Smooth rotation
		const currentAngle = this.mesh.rotation.y;
		const angleDiff = ((angle - currentAngle + Math.PI) % (Math.PI * 2)) - Math.PI;
		this.mesh.rotation.y += angleDiff * 0.2;

		// Update shoot cooldown
		if (this.shootCooldown > 0) {
			this.shootCooldown -= delta;
		}

		// Check if in range and cooldown is finished
		if (distanceToPlayer <= this.shootRange && this.shootCooldown <= 0) {
			this.shoot();
			this.shootCooldown = 2.0; // Reduced from 3.0 to 2.0 seconds for more frequent shots
		}
	}

	/**
	 * Create and fire a projectile at the player
	 */
	private shoot(): void {
		// Calculate damage based on wave number
		const baseDamage = 3;
		const waveDamageMultiplier = 1 + (this.waveNumber - 1) * 0.15;
		const finalDamage = Math.round(baseDamage * waveDamageMultiplier);

		// Get accurate player position
		const playerPosition = this.target.getPosition().clone();
		const enemyPosition = this.mesh.position.clone();

		// Calculate direction vector ensuring it's valid and normalized
		const directionToPlayer = new THREE.Vector3();
		directionToPlayer.subVectors(playerPosition, enemyPosition);

		// Check if direction vector is too small (player very close or at same position)
		if (directionToPlayer.lengthSq() < 0.001) {
			// Use a default direction if too close
			directionToPlayer.set(1, 0, 0);
		}

		// Ensure direction is normalized
		directionToPlayer.normalize();

		// Calculate projectile start position (slightly in front of the enemy)
		const offset = directionToPlayer.clone().multiplyScalar(0.8);
		const position = enemyPosition.clone().add(offset);
		position.y = 0.5; // Set consistent height

		// Create projectile with a smaller size
		const projectileGeometry = new THREE.SphereGeometry(0.25, 8, 8); // Reduced from 0.4 to 0.25
		const projectileMaterial = new THREE.MeshBasicMaterial({
			color: 0xff0000, // Bright red
			transparent: true,
			opacity: 0.8
		});

		// Create the projectile mesh
		const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
		projectile.position.copy(position);

		// Add small point light to make it glow
		const light = new THREE.PointLight(0xff0000, 0.7, 2);
		projectile.add(light);

		// Store projectile data directly on the projectile object
		projectile.userData = {
			direction: directionToPlayer.clone(),
			speed: 15,
			damage: finalDamage,
			lifetime: 3,
			timeLived: 0,
			active: true
		};

		// Add to scene and our tracking array
		this.scene.add(projectile);
		this.projectiles.push(projectile);

		// Create a visual flash effect at the enemy when shooting (smaller)
		const flashGeometry = new THREE.SphereGeometry(0.4, 8, 8); // Reduced from 0.5 to 0.4
		const flashMaterial = new THREE.MeshBasicMaterial({
			color: 0xff5500,
			transparent: true,
			opacity: 0.7
		});
		const flash = new THREE.Mesh(flashGeometry, flashMaterial);
		flash.position.copy(position);
		this.scene.add(flash);

		// Animate and remove the flash effect
		const startTime = performance.now();
		const animateFlash = () => {
			const elapsed = (performance.now() - startTime) / 1000;
			if (elapsed < 0.2) {
				flash.scale.set(1 - elapsed * 4, 1 - elapsed * 4, 1 - elapsed * 4);
				flashMaterial.opacity = 0.7 * (1 - elapsed * 5);
				requestAnimationFrame(animateFlash);
			} else {
				this.scene.remove(flash);
				flashMaterial.dispose();
				flashGeometry.dispose();
			}
		};
		requestAnimationFrame(animateFlash);
	}

	/**
	 * Clean up resources when enemy is removed
	 */
	public cleanup(): void {
		// Clean up all projectiles
		for (const projectile of this.projectiles) {
			this.scene.remove(projectile);
			// Clean up projectile resources if any
			if (projectile.material) {
				if (Array.isArray(projectile.material)) {
					projectile.material.forEach((m) => m.dispose());
				} else {
					projectile.material.dispose();
				}
			}
			if (projectile.geometry) {
				projectile.geometry.dispose();
			}
		}
		this.projectiles = [];

		// Call parent cleanup
		super.cleanup();
	}

	/**
	 * Handle enemy death
	 */
	public die(): void {
		super.die();
		// No need to manually clean up projectiles as the pool handles them
	}

	/**
	 * Update enemy state each frame
	 */
	public update(delta: number): void {
		if (this.isDead) return;

		super.update(delta);

		// Update projectiles
		this.updateProjectiles(delta);

		// Animate the ring for visual effect
		if (this.mesh.children.length > 1) {
			const ring = this.mesh.children[1] as THREE.Mesh;
			ring.rotation.z += delta * 1.5; // Increased rotation speed for more visual interest
			ring.rotation.x += delta * 0.5; // Added secondary rotation axis
		}
	}

	/**
	 * Update all projectiles fired by this enemy
	 */
	private updateProjectiles(delta: number): void {
		// Handle all projectiles in our array
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const projectile = this.projectiles[i];
			const data = projectile.userData;

			// Skip if somehow invalid
			if (!data || !data.active) {
				this.projectiles.splice(i, 1);
				this.scene.remove(projectile);
				continue;
			}

			// Move projectile forward based on direction and speed
			projectile.position.x += data.direction.x * data.speed * delta;
			projectile.position.z += data.direction.z * data.speed * delta;

			// Add subtle bobbing effect
			projectile.position.y = 0.5 + Math.sin(data.timeLived * 5) * 0.1;

			// Update lifetime
			data.timeLived += delta;

			// Check for collision with player
			const distanceToPlayer = projectile.position.distanceTo(this.target.getPosition());
			if (distanceToPlayer < 0.8) {
				// Player collision radius
				// Apply damage to player
				this.target.takeDamage(data.damage);

				// Remove this projectile
				this.scene.remove(projectile);
				this.projectiles.splice(i, 1);
				continue;
			}

			// Remove if lifetime is up
			if (data.timeLived >= data.lifetime) {
				this.scene.remove(projectile);
				this.projectiles.splice(i, 1);
			}
		}
	}
}

export class AoeRangedEnemy extends Enemy {
	private shootCooldown: number = 0;
	private readonly preferredDistance: number = 10; // Stays further away than regular ranged
	private readonly shootRange: number = 15; // Longer range than regular ranged
	private projectilePool: ProjectilePool;
	private projectiles: THREE.Mesh[] = [];
	private aoePools: Array<{ mesh: THREE.Mesh; timeRemaining: number }> = [];
	private readonly aoePoolDuration: number = 2; // Seconds before pool disappears

	constructor(
		scene: THREE.Scene,
		position: THREE.Vector3,
		target: PlayerCharacter,
		waveNumber: number = 1
	) {
		super(scene, position, target, EnemyType.AOE_RANGED, 2.5, 25, waveNumber);
		this.healthDropChance = 0.25; // Higher chance to drop health
		this.collisionRadius = 0.6;
		this.projectilePool = ProjectilePool.getInstance(scene);
	}

	protected createMesh(): THREE.Group {
		const enemyGroup = new THREE.Group();

		// Body - purple sphere
		const bodyGeometry = new THREE.SphereGeometry(0.6, 16, 16);
		const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x6600cc });
		const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
		bodyMesh.position.y = 0.6;
		enemyGroup.add(bodyMesh);

		// Outer ring - golden
		const ringGeometry = new THREE.TorusGeometry(0.8, 0.08, 8, 24);
		const ringMaterial = new THREE.MeshLambertMaterial({ color: 0xffaa00 });
		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.position.y = 0.6;
		ring.rotation.x = Math.PI / 2;
		enemyGroup.add(ring);

		// Second ring at different angle for cool effect
		const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
		ring2.position.y = 0.6;
		ring2.rotation.x = Math.PI / 4;
		ring2.rotation.z = Math.PI / 4;
		enemyGroup.add(ring2);

		return enemyGroup;
	}

	public update(delta: number): void {
		super.update(delta);

		// Update the AoE pools duration
		this.updateAoePools(delta);

		// Update the projectiles
		this.updateProjectiles(delta);
	}

	protected updateMovement(delta: number): void {
		// Calculate direction and distance to player
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position);
		const distanceToPlayer = this.moveDirection.length();
		this.moveDirection.normalize();

		// Set velocity based on preferred distance
		if (distanceToPlayer < this.preferredDistance - 1.5) {
			// Too close to player, move away
			this.velocity.copy(this.moveDirection).multiplyScalar(-this.speed * delta);
		} else if (distanceToPlayer > this.preferredDistance + 1.5) {
			// Too far from player, move closer
			this.velocity.copy(this.moveDirection).multiplyScalar(this.speed * delta);
		} else {
			// At good distance, strafe sideways
			const strafeDir = new THREE.Vector3(-this.moveDirection.z, 0, this.moveDirection.x);
			strafeDir.multiplyScalar(Math.sin(Date.now() * 0.001) * this.speed * delta);
			this.velocity.copy(strafeDir);
		}

		// Apply collision avoidance
		this.avoidOtherEnemies(delta);

		// Apply collision with player
		this.handlePlayerCollision(delta);

		// Apply final velocity
		this.mesh.position.add(this.velocity);

		// Face player
		const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
		this.mesh.rotation.y = angle;
	}

	protected updateAttack(delta: number): void {
		// Reduce cooldown timer
		if (this.shootCooldown > 0) {
			this.shootCooldown -= delta;
		}

		// Check if we can shoot
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());
		if (distanceToPlayer <= this.shootRange && this.shootCooldown <= 0) {
			this.shootAoeProjectile();
			this.shootCooldown = 2.0; // Longer cooldown due to its power
		}
	}

	private shootAoeProjectile(): void {
		// Direction to player
		const direction = new THREE.Vector3()
			.subVectors(this.target.getPosition(), this.mesh.position)
			.normalize();

		// Create projectile
		const projectileGeometry = new THREE.SphereGeometry(0.4, 8, 8);
		const projectileMaterial = new THREE.MeshBasicMaterial({
			color: 0xaa00ff,
			transparent: true,
			opacity: 0.8
		});

		const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

		// Set initial position
		const offset = direction.clone().multiplyScalar(1.0);
		projectile.position.copy(this.mesh.position.clone().add(offset));
		projectile.position.y = 0.6;

		// Add to scene
		this.scene.add(projectile);

		// Add light to projectile for glow effect
		const light = new THREE.PointLight(0xaa00ff, 1, 3);
		light.position.set(0, 0, 0);
		projectile.add(light);

		// Store projectile data
		projectile.userData = {
			direction: direction,
			speed: 6, // Slightly slower than before
			damage: 2, // Reduced from 3 to 2
			lifetime: 3, // Reduced lifetime
			timeLived: 0,
			isAoe: true
		};

		this.projectiles.push(projectile);

		// Visual effect for shooting
		this.createShootEffect();
	}

	private createShootEffect(): void {
		// Flash effect for shooting
		const flashGeometry = new THREE.SphereGeometry(0.7, 8, 8);
		const flashMaterial = new THREE.MeshBasicMaterial({
			color: 0xaa00ff,
			transparent: true,
			opacity: 0.7
		});

		const flash = new THREE.Mesh(flashGeometry, flashMaterial);
		flash.position.copy(this.mesh.position);
		flash.position.y = 0.6;
		this.scene.add(flash);

		// Animate the flash
		const startTime = Date.now();
		const animate = () => {
			const elapsed = (Date.now() - startTime) / 1000;
			const scale = 1 + elapsed * 2;

			if (elapsed < 0.3) {
				flash.scale.set(scale, scale, scale);
				flash.material.opacity = 0.7 * (1 - elapsed * 3.3);
				requestAnimationFrame(animate);
			} else {
				this.scene.remove(flash);
			}
		};

		animate();
	}

	private updateProjectiles(delta: number): void {
		// Update all projectiles
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const projectile = this.projectiles[i];
			const userData = projectile.userData;

			// Move projectile
			projectile.position.x += userData.direction.x * userData.speed * delta;
			projectile.position.z += userData.direction.z * userData.speed * delta;
			projectile.position.y = 0.6 + Math.sin(userData.timeLived * 5) * 0.1;

			// Update lifetime
			userData.timeLived += delta;

			// Check collision with player
			const distanceToPlayer = projectile.position.distanceTo(this.target.getPosition());
			if (distanceToPlayer < 0.8) {
				this.target.takeDamage(userData.damage);

				// Create AoE pool on hit
				this.createAoePool(projectile.position.clone());

				// Remove projectile
				this.scene.remove(projectile);
				this.projectiles.splice(i, 1);
				continue;
			}

			// Check lifetime or create pool if it hits the ground
			if (userData.timeLived >= userData.lifetime) {
				// Create AoE pool if it expires
				this.createAoePool(projectile.position.clone());

				// Remove projectile
				this.scene.remove(projectile);
				this.projectiles.splice(i, 1);
			}
		}
	}

	private createAoePool(position: THREE.Vector3): void {
		// Create an AoE pool on the ground
		position.y = 0.05; // Just above the ground

		const poolGeometry = new THREE.CircleGeometry(1.5, 32); // Reduced from 2 to 1.5
		poolGeometry.rotateX(-Math.PI / 2); // Flat on the ground

		const poolMaterial = new THREE.MeshBasicMaterial({
			color: 0xaa00ff,
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide
		});

		const poolMesh = new THREE.Mesh(poolGeometry, poolMaterial);
		poolMesh.position.copy(position);
		this.scene.add(poolMesh);

		// Add the pool to the collection
		this.aoePools.push({
			mesh: poolMesh,
			timeRemaining: this.aoePoolDuration
		});
	}

	private updateAoePools(delta: number): void {
		// Check for player in pools and update pool durations
		for (let i = this.aoePools.length - 1; i >= 0; i--) {
			const pool = this.aoePools[i];

			// Reduce time remaining
			pool.timeRemaining -= delta;

			// Apply visual fade out
			const material = pool.mesh.material as THREE.MeshBasicMaterial;
			material.opacity = 0.5 * (pool.timeRemaining / this.aoePoolDuration);

			// Check if player is in the pool
			const distanceToPlayer = pool.mesh.position.distanceTo(this.target.getPosition());
			if (distanceToPlayer < 1.5) {
				// Reduced from 2 to 1.5
				// Apply damage over time - once per second
				if (Math.floor(pool.timeRemaining) < Math.floor(pool.timeRemaining + delta)) {
					this.target.takeDamage(1); // Reduced from 2 to 1
				}
			}

			// Remove expired pools
			if (pool.timeRemaining <= 0) {
				this.scene.remove(pool.mesh);
				this.aoePools.splice(i, 1);
			}
		}
	}

	public cleanup(): void {
		// Call parent cleanup
		super.cleanup();

		// Remove all projectiles
		for (const projectile of this.projectiles) {
			this.scene.remove(projectile);
		}
		this.projectiles = [];

		// Remove all AoE pools
		for (const pool of this.aoePools) {
			this.scene.remove(pool.mesh);
		}
		this.aoePools = [];
	}

	public die(): void {
		// Call the parent die method
		super.die();
	}
}

export class BossEnemy extends Enemy {
	private attackCooldown: number = 0;
	private specialAttackCooldown: number = 0;
	private readonly attackRange: number = 2.0;
	private specialAttackTime: number = 0;
	private isDoingSpecialAttack: boolean = false;
	private projectiles: THREE.Mesh[] = [];
	private rotationAngle: number = 0;
	private readonly attackPhases = ['melee', 'ranged', 'special'];
	private currentPhase: number = 0;
	private phaseTimer: number = 0;
	private readonly phaseDuration: number = 10; // 10 seconds per phase

	constructor(
		scene: THREE.Scene,
		position: THREE.Vector3,
		target: PlayerCharacter,
		waveNumber: number = 10
	) {
		// Boss gets much stronger at wave 10
		// Base health is higher, and we apply an additional multiplier for the boss
		const bossMultiplier = 5.0; // Greatly increased from 2.5 to 5.0 for significantly stronger boss
		super(scene, position, target, EnemyType.BOSS, 1.3, 100, waveNumber); // Base health increased from 50 to 100

		// Override health calculation to make boss significantly stronger
		this.health = 100 * (1 + (waveNumber - 1) * 0.3) * bossMultiplier; // Increased scaling per wave from 0.2 to 0.3
		this.maxHealth = this.health;

		this.isBoss = true;
		this.healthDropChance = 1.0; // 100% chance to drop health
		this.collisionRadius = 1.8; // Much larger collision radius for boss
	}

	protected createMesh(): THREE.Group {
		const group = new THREE.Group();

		// Boss body - complex crystalline structure
		const bodyGeometry = new THREE.DodecahedronGeometry(0.8, 1);
		const bodyMaterial = new THREE.MeshStandardMaterial({
			color: 0xffcc00,
			emissive: 0xff6600,
			emissiveIntensity: 0.6,
			metalness: 0.9,
			roughness: 0.1
		});
		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		body.position.y = 0.8;
		body.castShadow = true;
		group.add(body);

		// Add energy core in the center
		const coreGeometry = new THREE.SphereGeometry(0.4, 24, 24);
		const coreMaterial = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			emissive: 0xffff00,
			emissiveIntensity: 1.0,
			transparent: true,
			opacity: 0.9
		});

		const core = new THREE.Mesh(coreGeometry, coreMaterial);
		core.position.y = 0.8;
		group.add(core);

		// Add a point light in the core
		const coreLight = new THREE.PointLight(0xffff00, 1.5, 8);
		coreLight.position.set(0, 0.8, 0);
		group.add(coreLight);

		// Add floating orbs around the boss
		for (let i = 0; i < 4; i++) {
			const angle = (i / 4) * Math.PI * 2;
			const orbGeometry = new THREE.SphereGeometry(0.3, 16, 16);
			const orbMaterial = new THREE.MeshStandardMaterial({
				color: 0xff3300,
				emissive: 0xff3300,
				emissiveIntensity: 0.8,
				transparent: true,
				opacity: 0.9
			});

			const orb = new THREE.Mesh(orbGeometry, orbMaterial);
			orb.position.set(Math.cos(angle) * 1.2, 0.8, Math.sin(angle) * 1.2);
			group.add(orb);

			// Add a point light to each orb
			const orbLight = new THREE.PointLight(0xff3300, 0.8, 3);
			orb.add(orbLight);
		}

		// Add cosmic rings around the boss
		const ringGeometry = new THREE.TorusGeometry(1.8, 0.08, 8, 48);
		const ringMaterial = new THREE.MeshStandardMaterial({
			color: 0x00ffff,
			emissive: 0x00ffff,
			emissiveIntensity: 0.5,
			transparent: true,
			opacity: 0.7,
			side: THREE.DoubleSide
		});

		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.rotation.x = Math.PI / 2;
		ring.position.y = 0.1;
		group.add(ring);

		// Add a second ring at a different angle
		const ring2 = new THREE.Mesh(ringGeometry, ringMaterial.clone());
		ring2.rotation.x = Math.PI / 3;
		ring2.rotation.y = Math.PI / 4;
		ring2.position.y = 0.8;
		group.add(ring2);

		// Add energy arc effects between orbs
		for (let i = 0; i < 4; i++) {
			const nextIdx = (i + 1) % 4;
			const orb1 = group.children[i + 3]; // Offset for body, core and coreLight
			const orb2 = group.children[nextIdx + 3];

			// Create an arc between orbs
			const arcGeometry = new THREE.TorusGeometry(0.6, 0.03, 8, 12, Math.PI);
			const arcMaterial = new THREE.MeshBasicMaterial({
				color: 0xff6600,
				transparent: true,
				opacity: 0.6
			});

			const arc = new THREE.Mesh(arcGeometry, arcMaterial);
			arc.position.y = 0.8;

			// Position and rotate to connect orbs
			const mid = new THREE.Vector3().addVectors(orb1.position, orb2.position).multiplyScalar(0.5);
			arc.position.copy(mid);

			// Store orb references for animation
			arc.userData.orb1 = i + 3;
			arc.userData.orb2 = nextIdx + 3;

			group.add(arc);
		}

		return group;
	}

	public update(delta: number): void {
		if (this.isDead) return;

		// Update phase timer
		this.phaseTimer += delta;
		if (this.phaseTimer >= this.phaseDuration) {
			this.phaseTimer = 0;
			this.currentPhase = (this.currentPhase + 1) % this.attackPhases.length;
			this.onPhaseChange();
		}

		// Update based on current phase
		const phase = this.attackPhases[this.currentPhase];

		if (phase === 'melee') {
			this.updateMeleePhase(delta);
		} else if (phase === 'ranged') {
			this.updateRangedPhase(delta);
		} else if (phase === 'special') {
			this.updateSpecialPhase(delta);
		}

		// Always update projectiles
		this.updateProjectiles(delta);

		// Rotate floating orbs
		this.rotationAngle += delta * 2;
		this.updateOrbPositions();

		// Special attack animation if active
		if (this.isDoingSpecialAttack) {
			this.specialAttackTime += delta;
			if (this.specialAttackTime >= 5) {
				// 5 seconds of special attack
				this.isDoingSpecialAttack = false;
				this.specialAttackTime = 0;
			}
		}
	}

	private onPhaseChange(): void {
		// Visual cue for phase change
		const indicator = this.mesh.children[this.mesh.children.length - 1] as THREE.Mesh;
		const material = indicator.material as THREE.MeshBasicMaterial;

		if (this.attackPhases[this.currentPhase] === 'melee') {
			material.color.set(0xff3300);
		} else if (this.attackPhases[this.currentPhase] === 'ranged') {
			material.color.set(0x3300ff);
		} else {
			material.color.set(0xffff00);
		}

		// Flash the boss on phase change
		const bodyMesh = this.mesh.children[0] as THREE.Mesh;
		const originalMaterial = bodyMesh.material as THREE.MeshStandardMaterial;
		const flashMaterial = originalMaterial.clone();
		flashMaterial.emissiveIntensity = 2.0;
		bodyMesh.material = flashMaterial;

		setTimeout(() => {
			if (!this.isDead) {
				bodyMesh.material = originalMaterial;
			}
		}, 300);
	}

	private updateMeleePhase(delta: number): void {
		// Move toward player more aggressively
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position).normalize();
		this.velocity.copy(this.moveDirection).multiplyScalar(this.speed * 1.2 * delta);

		// Apply collision avoidance with other enemies
		this.avoidOtherEnemies(delta);

		// Apply collision with player - but with less push for the boss
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());
		const minDistance = this.collisionRadius + 0.5; // Player radius estimated at 0.5

		if (distanceToPlayer < minDistance) {
			// Calculate bounce direction but with reduced effect
			const bounceDir = new THREE.Vector3()
				.subVectors(this.mesh.position, this.target.getPosition())
				.normalize();

			// Apply reduced bounce force for boss
			const bounceForce = bounceDir.multiplyScalar(this.speed * delta * 0.5);
			this.velocity.add(bounceForce);
		}

		// Apply final velocity
		this.mesh.position.add(this.velocity);

		// Rotate to face player
		const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
		// Smooth rotation
		const currentAngle = this.mesh.rotation.y;
		const angleDiff = ((angle - currentAngle + Math.PI) % (Math.PI * 2)) - Math.PI;
		this.mesh.rotation.y += angleDiff * 0.3;

		// Attack if in range
		if (this.attackCooldown > 0) {
			this.attackCooldown -= delta;
		}

		const distanceForAttack = this.mesh.position.distanceTo(this.target.getPosition());
		if (distanceForAttack <= this.attackRange && this.attackCooldown <= 0) {
			// Strong melee attack - increased from 2 to 4
			this.target.takeDamage(4);
			this.attackCooldown = 0.8;

			// Visual feedback for attack
			this.showAttackAnimation();
		}
	}

	private updateRangedPhase(delta: number): void {
		// Stay back from player
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position);
		const distanceToPlayer = this.moveDirection.length();
		this.moveDirection.normalize();

		const preferredDistance = 10;

		// Maintain distance
		if (distanceToPlayer < preferredDistance - 2) {
			// Too close to player, move away
			this.velocity.copy(this.moveDirection).multiplyScalar(-this.speed * delta);
		} else if (distanceToPlayer > preferredDistance + 2) {
			// Too far from player, move closer
			this.velocity.copy(this.moveDirection).multiplyScalar(this.speed * delta);
		} else {
			// Strafe sideways
			const strafeDir = new THREE.Vector3(-this.moveDirection.z, 0, this.moveDirection.x);
			strafeDir.multiplyScalar(Math.sin(Date.now() * 0.001) * this.speed * delta);
			this.velocity.copy(strafeDir);
		}

		// Apply collision avoidance with other enemies
		this.avoidOtherEnemies(delta);

		// Apply collision with player
		this.handlePlayerCollision(delta);

		// Apply final velocity
		this.mesh.position.add(this.velocity);

		// Face player
		const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
		// Smooth rotation
		const currentAngle = this.mesh.rotation.y;
		const angleDiff = ((angle - currentAngle + Math.PI) % (Math.PI * 2)) - Math.PI;
		this.mesh.rotation.y += angleDiff * 0.2;

		// Shoot at player
		if (this.attackCooldown > 0) {
			this.attackCooldown -= delta;
		}

		if (this.attackCooldown <= 0) {
			this.shootMultiple();
			this.attackCooldown = 1.5;
		}
	}

	private updateSpecialPhase(delta: number): void {
		// Special phase - spin and shoot in all directions
		if (this.specialAttackCooldown > 0) {
			this.specialAttackCooldown -= delta;
		}

		// Move slower during special phase but with base velocity toward player
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position).normalize();
		this.velocity.copy(this.moveDirection).multiplyScalar(this.speed * 0.5 * delta);

		// Apply collision avoidance with other enemies
		this.avoidOtherEnemies(delta);

		// Apply collision with player but with minimal effect
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());
		const minDistance = this.collisionRadius + 0.5;

		if (distanceToPlayer < minDistance) {
			const bounceDir = new THREE.Vector3()
				.subVectors(this.mesh.position, this.target.getPosition())
				.normalize();

			// Very minimal bounce for special phase
			const bounceForce = bounceDir.multiplyScalar(this.speed * delta * 0.3);
			this.velocity.add(bounceForce);
		}

		// Apply final velocity
		this.mesh.position.add(this.velocity);

		// Spin around regardless of movement direction
		this.mesh.rotation.y += delta * 3;

		// Shoot in multiple directions during special attack
		if (this.specialAttackCooldown <= 0) {
			this.specialAttack();
			this.specialAttackCooldown = 2.0;

			// Do ground slam occasionally
			if (Math.random() < 0.3) {
				this.groundSlam();
			}
		}
	}

	private updateOrbPositions(): void {
		// Update the orbiting orbs
		for (let i = 0; i < 4; i++) {
			const angle = this.rotationAngle + (i / 4) * Math.PI * 2;
			const orb = this.mesh.children[i + 3]; // Offset for body, core and coreLight
			orb.position.x = Math.cos(angle) * 1.2;
			orb.position.z = Math.sin(angle) * 1.2;

			// Add bobbing motion
			orb.position.y = 0.8 + Math.sin(angle * 2) * 0.2;

			// Pulsate glow
			const orbLight = orb.children[0] as THREE.PointLight;
			orbLight.intensity = 0.5 + Math.sin(this.rotationAngle * 3 + i) * 0.3;
		}

		// Animate rings
		const ring1 = this.mesh.children[7] as THREE.Mesh;
		const ring2 = this.mesh.children[8] as THREE.Mesh;

		ring1.rotation.z += 0.01;
		ring2.rotation.z -= 0.008;
		ring2.rotation.x += 0.005;

		// Update energy arcs to connect orbs
		for (let i = 0; i < 4; i++) {
			const arc = this.mesh.children[i + 9] as THREE.Mesh; // Offset for previous elements
			const orb1 = this.mesh.children[arc.userData.orb1] as THREE.Mesh;
			const orb2 = this.mesh.children[arc.userData.orb2] as THREE.Mesh;

			// Calculate midpoint between orbs
			const mid = new THREE.Vector3().addVectors(orb1.position, orb2.position).multiplyScalar(0.5);
			arc.position.copy(mid);

			// Orient arc to face between the orbs
			const dir = new THREE.Vector3().subVectors(orb2.position, orb1.position).normalize();
			const axis = new THREE.Vector3(0, 1, 0);
			arc.quaternion.setFromUnitVectors(axis, dir);
			arc.rotation.x = Math.PI / 2;

			// Pulsate opacity
			const material = arc.material as THREE.MeshBasicMaterial;
			material.opacity = 0.3 + Math.sin(this.rotationAngle * 5 + i * 0.5) * 0.3;
		}

		// Pulsate core
		const core = this.mesh.children[1] as THREE.Mesh;
		const coreMaterial = core.material as THREE.MeshStandardMaterial;
		coreMaterial.emissiveIntensity = 0.8 + Math.sin(this.rotationAngle * 2) * 0.2;

		const coreLight = this.mesh.children[2] as THREE.PointLight;
		coreLight.intensity = 1.2 + Math.sin(this.rotationAngle * 2) * 0.3;
	}

	private showAttackAnimation(): void {
		// Scale up and down quickly to show attack
		const originalScale = this.mesh.scale.clone();

		// Scale up
		this.mesh.scale.set(1.3, 1.3, 1.3);

		// After a short delay, scale back down
		setTimeout(() => {
			if (!this.isDead) {
				this.mesh.scale.copy(originalScale);
			}
		}, 150);
	}

	private shootMultiple(): void {
		// Shoot 3 projectiles in a spread pattern
		const directions = [
			this.moveDirection.clone(),
			this.moveDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.2),
			this.moveDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.2)
		];

		directions.forEach((direction) => {
			this.shootProjectile(direction, 0xff3300, 1);
		});
	}

	private specialAttack(): void {
		// Shoot projectiles in all directions
		for (let i = 0; i < 8; i++) {
			const angle = (i / 8) * Math.PI * 2;
			const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
			this.shootProjectile(direction, 0xffff00, 2);
		}
	}

	private groundSlam(): void {
		// Visual effect for ground slam
		const ringGeometry = new THREE.RingGeometry(0.5, 8, 32);
		ringGeometry.rotateX(Math.PI / 2);

		const ringMaterial = new THREE.MeshBasicMaterial({
			color: 0xff6600,
			transparent: true,
			opacity: 0.8,
			side: THREE.DoubleSide
		});

		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.position.copy(this.mesh.position);
		ring.position.y = 0.1;
		this.scene.add(ring);

		// Animate the ring expanding and fading
		const startTime = Date.now();
		const animate = () => {
			const elapsed = (Date.now() - startTime) / 1000;
			const scale = 1 + elapsed * 2;

			if (elapsed < 1.0) {
				ring.scale.set(scale, scale, scale);
				ring.material.opacity = 0.8 * (1 - elapsed);
				requestAnimationFrame(animate);
			} else {
				this.scene.remove(ring);
			}
		};

		animate();

		// Damage player if in range - increased from 3 to 6
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());
		if (distanceToPlayer < 5) {
			this.target.takeDamage(6);
		}
	}

	private shootProjectile(direction: THREE.Vector3, color: number, damage: number): void {
		// Create projectile
		const projectileGeometry = new THREE.SphereGeometry(0.3, 12, 12);
		const projectileMaterial = new THREE.MeshBasicMaterial({
			color: color,
			transparent: true,
			opacity: 0.8
		});

		const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

		// Set initial position
		const offset = direction.clone().multiplyScalar(1.5);
		projectile.position.copy(this.mesh.position.clone().add(offset));
		projectile.position.y = 1.0;

		// Add to scene and list
		this.scene.add(projectile);

		// Add light to projectile for glow effect
		const light = new THREE.PointLight(color, 1, 3);
		light.position.set(0, 0, 0);
		projectile.add(light);

		// Store direction and other properties - increased base damage by 1.5x
		const enhancedDamage = Math.round(damage * 1.5);
		const userData = {
			direction: direction,
			speed: 6,
			damage: enhancedDamage,
			lifetime: 5,
			timeLived: 0
		};

		projectile.userData = userData;
		this.projectiles.push(projectile);
	}

	private updateProjectiles(delta: number): void {
		// Update all projectiles
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const projectile = this.projectiles[i];
			const userData = projectile.userData;

			// Move projectile
			projectile.position.x += userData.direction.x * userData.speed * delta;
			projectile.position.z += userData.direction.z * userData.speed * delta;

			// Add bobbing effect
			projectile.position.y = 1.0 + Math.sin(userData.timeLived * 5) * 0.2;

			// Update lifetime
			userData.timeLived += delta;

			// Check collision with player
			const distanceToPlayer = projectile.position.distanceTo(this.target.getPosition());
			if (distanceToPlayer < 0.8) {
				this.target.takeDamage(userData.damage);

				// Remove projectile
				this.scene.remove(projectile);
				this.projectiles.splice(i, 1);
				continue;
			}

			// Check lifetime
			if (userData.timeLived >= userData.lifetime) {
				this.scene.remove(projectile);
				this.projectiles.splice(i, 1);
			}
		}
	}

	public cleanup(): void {
		super.cleanup();

		// Remove all projectiles
		for (const projectile of this.projectiles) {
			this.scene.remove(projectile);
		}
		this.projectiles = [];
	}

	public die(): void {
		super.die();
		// No need to manually call cleanup as super.die() will call cleanup()
	}
}
