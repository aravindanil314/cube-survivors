import * as THREE from 'three';
import { Debug } from '../utils/Debug';
import type { SpatialGrid, SpatialObject } from '../utils/SpatialGrid';
import type { StatusEffectType } from '../entities/StatusEffect';

// Define interface for status effect data
interface StatusEffectData {
	id: string;
	type: StatusEffectType;
	duration: number;
	tickInterval?: number;
	onTick?: (target: Enemy) => void;
	onStart?: () => void;
	onEnd?: () => void;
}

// Define interface for enemy objects with compatibility for spatial grid
interface Enemy extends SpatialObject {
	isDead: boolean;
	takeDamage(amount: number): void;
	addStatusEffect(effect: StatusEffectData): void;
	attachEffect(effect: THREE.Object3D, id: string): void;
	removeEffect(id: string): void;
	// Add getCollisionRadius for compatibility with existing code
	getCollisionRadius(): number;
	// Add getPosition for compatibility with existing code
	getPosition(): THREE.Vector3;
}

// Define interface for projectiles
interface Projectile {
	getPosition(): THREE.Vector3;
	getCollisionRadius(): number;
	isCollidingWith(position: THREE.Vector3, radius: number): boolean;
	damage: number;
	cleanup(): void;
}

// Define interface for projectile manager
interface ProjectileManager {
	fire(position: THREE.Vector3, direction: THREE.Vector3, options: ProjectileOptions): void;
	update(delta: number): void;
	getProjectiles(): Projectile[];
	clear(): void;
}

// Define interface for projectile properties
export interface ProjectileOptions {
	damage: number;
	speed: number;
	lifetime?: number;
	color?: THREE.ColorRepresentation;
}

/**
 * WeaponStats interface defines the properties of a weapon
 */
export interface WeaponStats {
	damage: number;
	cooldownTime: number;
	projectileSpeed: number;
	projectileCount: number;
	spreadAngle: number;
	hasCriticalHits: boolean;
	criticalChance: number;
	criticalMultiplier: number;
	hasPiercing: boolean;
	hasPoisonDamage: boolean;
	poisonDuration: number;
	poisonDamage: number;
}

/**
 * Improved Weapon class that uses the ProjectileManager and spatial partitioning
 */
export class Weapon {
	private scene: THREE.Scene;
	private player: THREE.Object3D;
	private projectileManager: ProjectileManager;
	private debug = Debug.getInstance();
	private level: number = 1;
	private stats: WeaponStats;
	private cooldownTimer: number = 0;
	private critFlashMaterial: THREE.MeshBasicMaterial;
	private tempVector = new THREE.Vector3();

	constructor(scene: THREE.Scene, player: THREE.Object3D) {
		this.scene = scene;
		this.player = player;

		// Create a placeholder projectile manager until a real one is provided
		this.projectileManager = {
			fire: () => {},
			update: () => {},
			getProjectiles: () => [],
			clear: () => {}
		};

		// Default weapon stats
		this.stats = {
			damage: 1,
			cooldownTime: 0.5,
			projectileSpeed: 10,
			projectileCount: 1,
			spreadAngle: 0,
			hasCriticalHits: false,
			criticalChance: 0.1,
			criticalMultiplier: 2.0,
			hasPiercing: false,
			hasPoisonDamage: false,
			poisonDuration: 3,
			poisonDamage: 0.5
		};

		// Create reusable material for critical hit effects
		this.critFlashMaterial = new THREE.MeshBasicMaterial({
			color: 0xffff00,
			transparent: true,
			opacity: 0.8
		});

		this.debug.info('Weapon initialized');
	}

	/**
	 * Update weapon cooldown and projectiles
	 */
	public update(delta: number): void {
		// Update cooldown timer
		if (this.cooldownTimer > 0) {
			this.cooldownTimer -= delta;
		}

		// Auto-fire weapon
		if (this.cooldownTimer <= 0) {
			this.fire();
		}

		// Update all projectiles
		this.projectileManager.update(delta);
	}

	/**
	 * Fire weapon, creating projectiles
	 */
	public fire(): void {
		if (this.cooldownTimer > 0) return;

		// Reset cooldown
		this.cooldownTimer = this.stats.cooldownTime;

		// Calculate direction based on player rotation
		const playerRotation = this.player.rotation.y;

		// Create projectiles
		for (let i = 0; i < this.stats.projectileCount; i++) {
			let angle = playerRotation;

			// Apply spread if we have multiple projectiles
			if (this.stats.projectileCount > 1) {
				const spread = this.stats.spreadAngle / 2;
				angle += ((i / (this.stats.projectileCount - 1)) * 2 - 1) * spread;
			}

			const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

			// Create projectile starting from player position
			const position = this.player.position.clone();
			position.y = 0.5; // Set y to match player height

			// Configure projectile options
			const options: ProjectileOptions = {
				damage: this.stats.damage,
				speed: this.stats.projectileSpeed,
				lifetime: 3.0, // 3 seconds
				color: 0xffff00 // Yellow
			};

			// Fire projectile
			this.projectileManager.fire(position, direction, options);
		}

		this.debug.debug(`Fired ${this.stats.projectileCount} projectiles`);
	}

	/**
	 * Check projectile collisions with enemies and apply damage
	 */
	public checkEnemyCollisions(enemies: Enemy[], spatialGrid?: SpatialGrid<Enemy>): Enemy[] {
		const killedEnemies: Enemy[] = [];
		const projectiles = this.projectileManager.getProjectiles();

		// Map for tracking which enemies were hit by which projectiles
		const hitMap = new Map<Enemy, Set<number>>();

		// Check each projectile against each enemy
		for (let i = 0; i < projectiles.length; i++) {
			const projectile = projectiles[i];
			let hitEnemy = false;

			// First get potential collisions using spatial grid if available
			let enemiesToCheck = enemies;
			if (spatialGrid) {
				// Use spatial grid to get only nearby enemies
				enemiesToCheck = spatialGrid.queryRadius(
					projectile.getPosition(),
					projectile.getCollisionRadius() + 1 // Add safety margin
				);
			}

			for (const enemy of enemiesToCheck) {
				if (enemy.isDead) continue;

				// Skip if this enemy was already hit by this projectile and we don't have piercing
				if (!this.stats.hasPiercing && hitMap.has(enemy) && hitMap.get(enemy)!.has(i)) {
					continue;
				}

				// Check collision
				if (projectile.isCollidingWith(enemy.getPosition(), enemy.getCollisionRadius())) {
					let damage = projectile.damage;

					// Apply critical hit if enabled
					if (this.stats.hasCriticalHits && Math.random() < this.stats.criticalChance) {
						damage *= this.stats.criticalMultiplier;
						this.showCriticalHitEffect(enemy.getPosition());
					}

					// Apply direct damage
					enemy.takeDamage(damage);

					// Apply poison damage if enabled
					if (this.stats.hasPoisonDamage) {
						this.applyPoisonDamage(enemy);
					}

					hitEnemy = true;

					// Track hit for this enemy and projectile
					if (!hitMap.has(enemy)) {
						hitMap.set(enemy, new Set<number>());
					}
					hitMap.get(enemy)!.add(i);

					// Check if enemy was killed
					if (enemy.isDead) {
						killedEnemies.push(enemy);
					}

					// If no piercing, stop checking this projectile against more enemies
					if (!this.stats.hasPiercing) {
						break;
					}
				}
			}

			// Deactivate the projectile if it hit an enemy and doesn't have piercing
			if (hitEnemy && !this.stats.hasPiercing) {
				projectile.cleanup();
			}
		}

		return killedEnemies;
	}

	/**
	 * Apply poison damage over time to an enemy
	 */
	private applyPoisonDamage(enemy: Enemy): void {
		if (enemy.isDead) return;

		const poisonId = `poison_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
		enemy.addStatusEffect({
			id: poisonId,
			type: 'poison',
			duration: this.stats.poisonDuration,
			tickInterval: 0.5, // Apply damage every 0.5 seconds
			onTick: (e: Enemy) => {
				if (!e.isDead) {
					e.takeDamage(this.stats.poisonDamage * 0.5);
				}
			},
			onStart: () => {
				// Create poison effect
				const poisonEffect = this.createPoisonEffect();
				enemy.attachEffect(poisonEffect, poisonId);
			},
			onEnd: () => {
				// Remove poison effect
				enemy.removeEffect(poisonId);
			}
		});
	}

	/**
	 * Create visual effect for poison
	 */
	private createPoisonEffect(): THREE.Object3D {
		const group = new THREE.Group();

		// Create poison particles
		const particleCount = 10;
		const particleGeometry = new THREE.BufferGeometry();
		const particlePositions = new Float32Array(particleCount * 3);

		// Random positions around the enemy
		for (let i = 0; i < particleCount; i++) {
			const angle = Math.random() * Math.PI * 2;
			const radius = 0.3 + Math.random() * 0.5;
			particlePositions[i * 3] = Math.sin(angle) * radius;
			particlePositions[i * 3 + 1] = 0.5 + Math.random() * 0.5;
			particlePositions[i * 3 + 2] = Math.cos(angle) * radius;
		}

		particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

		// Green poison particles
		const particleMaterial = new THREE.PointsMaterial({
			color: 0x66ff33,
			size: 0.2,
			transparent: true,
			opacity: 0.7
		});

		const particles = new THREE.Points(particleGeometry, particleMaterial);
		group.add(particles);

		return group;
	}

	/**
	 * Show critical hit effect
	 */
	private showCriticalHitEffect(position: THREE.Vector3): void {
		// Create a flash effect for critical hits
		const geometry = new THREE.SphereGeometry(0.5, 16, 16);
		const material = this.critFlashMaterial.clone();

		const flash = new THREE.Mesh(geometry, material);
		flash.position.copy(position);
		flash.position.y += 0.5;
		this.scene.add(flash);

		// Animate flash expanding and fading
		const startTime = performance.now();
		const duration = 300; // ms

		const animateFlash = () => {
			const elapsed = performance.now() - startTime;
			const progress = elapsed / duration;

			if (progress < 1) {
				flash.scale.set(1 + progress * 2, 1 + progress * 2, 1 + progress * 2);
				material.opacity = 0.8 * (1 - progress);
				requestAnimationFrame(animateFlash);
			} else {
				this.scene.remove(flash);
			}
		};

		animateFlash();
		this.showCritText(position);
	}

	/**
	 * Show critical hit text
	 */
	private showCritText(position: THREE.Vector3): void {
		// Create canvas for 2D text
		const canvas = document.createElement('canvas');
		canvas.width = 128;
		canvas.height = 64;
		const context = canvas.getContext('2d');

		if (context) {
			context.fillStyle = 'rgba(0, 0, 0, 0)';
			context.fillRect(0, 0, canvas.width, canvas.height);

			context.font = 'bold 48px Arial';
			context.fillStyle = '#ffff00';
			context.strokeStyle = '#000000';
			context.lineWidth = 4;
			context.textAlign = 'center';
			context.strokeText('CRIT!', canvas.width / 2, canvas.height / 2);
			context.fillText('CRIT!', canvas.width / 2, canvas.height / 2);

			// Create texture from canvas
			const texture = new THREE.CanvasTexture(canvas);

			// Create sprite using texture
			const spriteMaterial = new THREE.SpriteMaterial({
				map: texture,
				transparent: true
			});

			const sprite = new THREE.Sprite(spriteMaterial);
			sprite.position.copy(position);
			sprite.position.y += 1.5;
			sprite.scale.set(2, 1, 1);
			this.scene.add(sprite);

			// Animate text rising and fading
			const startTime = performance.now();
			const duration = 1000; // ms

			const animateText = () => {
				const elapsed = performance.now() - startTime;
				const progress = elapsed / duration;

				if (progress < 1) {
					sprite.position.y += 0.01;
					spriteMaterial.opacity = 1 - progress;
					requestAnimationFrame(animateText);
				} else {
					this.scene.remove(sprite);
				}
			};

			animateText();
		}
	}

	/**
	 * Upgrade weapon based on level
	 */
	public upgrade(level?: number): void {
		// Use provided level for special upgrades if available
		if (level !== undefined) {
			// Special level-based upgrades
			this.stats.damage = Math.max(1, level * 0.5);
			this.stats.cooldownTime = Math.max(0.1, 0.5 - level * 0.02);
			this.stats.projectileCount = Math.min(5, 1 + Math.floor(level / 3));
			this.stats.spreadAngle = Math.min(Math.PI / 6, (this.stats.projectileCount - 1) * 0.1);
			this.level = level;
			this.debug.info(`Weapon upgraded to match player level ${level}`);
			return;
		}

		// Regular incremental upgrade
		this.level++;

		// Every level, increase damage
		this.stats.damage += 0.5;

		// Every 2 levels, decrease cooldown
		if (this.level % 2 === 0) {
			this.stats.cooldownTime = Math.max(0.1, this.stats.cooldownTime - 0.05);
		}

		// Every 3 levels, add a projectile
		if (this.level % 3 === 0) {
			this.stats.projectileCount++;
			this.stats.spreadAngle = Math.min(Math.PI / 6, (this.stats.projectileCount - 1) * 0.1);
		}

		this.debug.info(`Weapon upgraded to level ${this.level}`);
	}

	/**
	 * Clean up resources
	 */
	public cleanup(): void {
		this.projectileManager.clear();
	}

	// Various getters and setters for weapon stats

	public getProjectileDamage(): number {
		return this.stats.damage;
	}

	public setProjectileDamage(value: number): void {
		this.stats.damage = value;
	}

	public getCooldownTime(): number {
		return this.stats.cooldownTime;
	}

	public setCooldownTime(value: number): void {
		this.stats.cooldownTime = Math.max(0.1, value);
	}

	public enableCriticalHits(): void {
		if (this.stats.hasCriticalHits) {
			// If already enabled, increase chance or multiplier
			this.stats.criticalChance = Math.min(0.5, this.stats.criticalChance + 0.05);
			this.stats.criticalMultiplier += 0.2;
		} else {
			this.stats.hasCriticalHits = true;
		}
	}

	public increaseProjectileCount(count: number): void {
		this.stats.projectileCount += count;
		this.stats.spreadAngle = Math.min(Math.PI / 4, (this.stats.projectileCount - 1) * 0.1);
	}

	public increaseProjectileSpeed(percentage: number): void {
		this.stats.projectileSpeed *= 1 + percentage;
	}

	public enablePiercing(): void {
		this.stats.hasPiercing = true;
	}

	public enablePoisonDamage(): void {
		if (this.stats.hasPoisonDamage) {
			// If already enabled, increase poison damage or duration
			this.stats.poisonDamage += 0.3;
			this.stats.poisonDuration += 1;
		} else {
			this.stats.hasPoisonDamage = true;
		}
	}

	public getStats(): WeaponStats {
		return { ...this.stats }; // Return a copy to prevent direct modification
	}

	public getLevel(): number {
		return this.level;
	}
}
