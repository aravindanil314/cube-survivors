import * as THREE from 'three';

/**
 * Projectile data interface
 */
interface ProjectileData {
	direction: THREE.Vector3;
	speed: number;
	damage: number;
	lifetime: number;
	timeLived: number;
	active: boolean;
	owner: object | null; // Reference to the owner enemy
}

/**
 * ProjectilePool - Manages a pool of reusable projectile objects
 * This dramatically improves performance by avoiding constant creation/deletion
 * of THREE.js objects
 */
export class ProjectilePool {
	private scene!: THREE.Scene; // ! means definitely assigned in constructor
	private poolSize!: number;
	private projectiles: THREE.Group[] = [];
	private activeCount: number = 0;

	// Use singleton pattern for global access
	private static instance: ProjectilePool | null = null;

	constructor(scene: THREE.Scene, poolSize: number = 300) {
		if (ProjectilePool.instance) {
			return ProjectilePool.instance as unknown as ProjectilePool;
		}
		this.scene = scene;
		this.poolSize = poolSize;

		// Initialize pool with inactive projectiles
		this.initializePool();

		// Set instance for singleton access
		ProjectilePool.instance = this;
	}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(scene?: THREE.Scene, poolSize?: number): ProjectilePool {
		if (!ProjectilePool.instance && scene) {
			return new ProjectilePool(scene, poolSize);
		}

		if (!ProjectilePool.instance) {
			throw new Error('ProjectilePool not initialized!');
		}

		return ProjectilePool.instance;
	}

	/**
	 * Initialize the object pool
	 */
	private initializePool(): void {
		for (let i = 0; i < this.poolSize; i++) {
			// Create projectile group to hold mesh and effects
			const projectileGroup = new THREE.Group();

			// Create projectile mesh with obvious material
			const projectileMesh = new THREE.Mesh(
				new THREE.SphereGeometry(0.4, 8, 8), // Larger size for better visibility
				new THREE.MeshBasicMaterial({
					color: 0xff00ff, // Bright magenta
					transparent: true,
					opacity: 0.9
				})
			);
			projectileGroup.add(projectileMesh);

			// Add a point light for glow effect
			const light = new THREE.PointLight(0xff00ff, 1, 4);
			projectileGroup.add(light);

			// Set initial state as inactive
			projectileGroup.visible = false;

			// Set initial userData
			projectileGroup.userData = {
				active: false,
				direction: new THREE.Vector3(),
				speed: 0,
				damage: 0,
				lifetime: 0,
				timeLived: 0,
				owner: null
			} as ProjectileData;

			// Add to scene but hidden
			this.scene.add(projectileGroup);
			this.projectiles.push(projectileGroup);
		}
	}

	/**
	 * Get a projectile from the pool
	 */
	public getProjectile(
		position: THREE.Vector3,
		direction: THREE.Vector3,
		speed: number,
		damage: number,
		lifetime: number = 4,
		color: number = 0xff00ff,
		owner: object | null = null
	): THREE.Group | null {
		// Find an inactive projectile
		for (let i = 0; i < this.projectiles.length; i++) {
			const projectileGroup = this.projectiles[i];
			const data = projectileGroup.userData as ProjectileData;

			if (!data.active) {
				// Ensure direction is valid
				const validDirection =
					direction.lengthSq() > 0.001 ? direction.clone().normalize() : new THREE.Vector3(1, 0, 0);

				// Set projectile data
				data.active = true;
				data.direction = validDirection;
				data.speed = speed;
				data.damage = damage;
				data.lifetime = lifetime;
				data.timeLived = 0;
				data.owner = owner;

				// Set position
				projectileGroup.position.copy(position);

				// Set color if the projectile has children
				if (projectileGroup.children.length > 0) {
					const mesh = projectileGroup.children[0] as THREE.Mesh;
					const material = mesh.material as THREE.MeshBasicMaterial;
					material.color.setHex(color);

					// Also update light color if present
					if (projectileGroup.children.length > 1) {
						const light = projectileGroup.children[1] as THREE.PointLight;
						light.color.setHex(color);
					}
				}

				// Make visible
				projectileGroup.visible = true;

				this.activeCount++;
				return projectileGroup;
			}
		}

		return null;
	}

	/**
	 * Release a projectile back to the pool
	 */
	public releaseProjectile(projectile: THREE.Group): void {
		const data = projectile.userData as ProjectileData;
		data.active = false;
		projectile.visible = false;
		this.activeCount--;
	}

	/**
	 * Update all active projectiles
	 */
	public update(delta: number, player: THREE.Object3D): void {
		if (!player) {
			return;
		}

		// Get player reference for collision detection
		const playerPosition = player.position;
		const playerCollisionRadius = 0.7;

		// No longer tracking these counts as they aren't used
		// (removed unused variables to fix lint errors)

		// Process each projectile
		for (let i = 0; i < this.projectiles.length; i++) {
			const projectile = this.projectiles[i];
			const data = projectile.userData as ProjectileData;

			// Skip inactive projectiles
			if (!data.active || !projectile.visible) continue;

			// Validate direction to avoid problems
			if (data.direction.lengthSq() < 0.001) {
				data.direction.set(1, 0, 0);
				// Set safe direction without logging
			}

			// Previously tracked position changes, but removed for simplicity

			// Move projectile
			projectile.position.x += data.direction.x * data.speed * delta;
			projectile.position.z += data.direction.z * data.speed * delta;

			// Previously checked movement and counted moves
			// (removed unused move counting code to fix lint errors)

			// Add slight bobbing
			projectile.position.y = 0.5 + Math.sin(data.timeLived * 5) * 0.1;

			// Update lifetime
			data.timeLived += delta;

			// Removed unnecessary movement logging

			// Check for player collision
			const dx = projectile.position.x - playerPosition.x;
			const dz = projectile.position.z - playerPosition.z;
			const distanceSquared = dx * dx + dz * dz;

			if (distanceSquared < playerCollisionRadius * playerCollisionRadius) {
				const playerChar = player.parent?.userData.gameEngine?.player;
				if (playerChar && typeof playerChar.takeDamage === 'function') {
					playerChar.takeDamage(data.damage);
					this.releaseProjectile(projectile);
					continue;
				}
			}

			// Check if projectile lifetime is up
			if (data.timeLived >= data.lifetime) {
				this.releaseProjectile(projectile);
			}
		}
	}

	/**
	 * Get active projectile count
	 */
	public getActiveCount(): number {
		return this.activeCount;
	}

	/**
	 * Get total pool size
	 */
	public getPoolSize(): number {
		return this.poolSize;
	}

	/**
	 * Clean up resources when destroyed
	 */
	public cleanup(): void {
		// Remove all projectiles from scene
		for (const projectile of this.projectiles) {
			// Dispose materials if available
			if (projectile.children.length > 0) {
				const mesh = projectile.children[0] as THREE.Mesh;
				if (mesh.material) {
					if (Array.isArray(mesh.material)) {
						mesh.material.forEach((m) => m.dispose());
					} else {
						mesh.material.dispose();
					}
				}
				if (mesh.geometry) {
					mesh.geometry.dispose();
				}
			}
			this.scene.remove(projectile);
		}

		this.projectiles = [];
		this.activeCount = 0;

		// Reset singleton
		ProjectilePool.instance = null;
	}
}
