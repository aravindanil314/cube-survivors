import * as THREE from 'three';
import { PlayerCharacter } from './PlayerCharacter';
import { Enemy } from './Enemy';

export class Weapon {
	private scene: THREE.Scene;
	private player: PlayerCharacter;
	private projectiles: Projectile[] = [];
	private cooldownTime: number = 0.5; // seconds between shots
	private cooldownTimer: number = 0;
	private projectileSpeed: number = 10;
	private projectileDamage: number = 100;
	private projectileCount: number = 1;
	private spreadAngle: number = 0;
	private level: number = 1;
	private hasCriticalHits: boolean = false;
	private criticalChance: number = 0.1; // 10% chance
	private criticalMultiplier: number = 2.0; // double damage
	private hasPiercing: boolean = false;
	private hasPoisonDamage: boolean = false;
	private poisonDuration: number = 3; // seconds
	private poisonDamage: number = 0.5; // damage per second
	private maxProjectiles: number = 100; // Limit maximum active projectiles

	constructor(scene: THREE.Scene, player: PlayerCharacter) {
		this.scene = scene;
		this.player = player;
	}

	public update(delta: number): void {
		// Update cooldown timer
		if (this.cooldownTimer > 0) {
			this.cooldownTimer -= delta;
		}

		// Auto-fire weapon
		if (this.cooldownTimer <= 0) {
			this.fire();
		}

		// Update projectiles
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const projectile = this.projectiles[i];
			projectile.update(delta);

			// Remove projectiles that are out of bounds or too old
			if (
				Math.abs(projectile.mesh.position.x) > 30 ||
				Math.abs(projectile.mesh.position.z) > 30 ||
				projectile.getLifetime() > 3.0 // Max lifetime of 3 seconds
			) {
				this.disposeProjectile(projectile, i);
			}
		}
	}

	private disposeProjectile(projectile: Projectile, index: number): void {
		projectile.cleanup();
		this.projectiles.splice(index, 1);
	}

	public fire(): void {
		if (this.cooldownTimer > 0) return;

		// Reset cooldown
		this.cooldownTimer = this.cooldownTime;

		// If we have too many projectiles, don't create more
		if (this.projectiles.length >= this.maxProjectiles) {
			// Remove oldest projectiles to make room
			const removeCount = Math.min(
				this.projectileCount,
				this.projectiles.length - this.maxProjectiles + this.projectileCount
			);
			for (let i = 0; i < removeCount; i++) {
				this.disposeProjectile(this.projectiles[0], 0);
			}
		}

		// Calculate direction based on player rotation
		const playerRotation = this.player.mesh.rotation.y;

		// Create projectiles
		for (let i = 0; i < this.projectileCount; i++) {
			let angle = playerRotation;

			// Apply spread if we have multiple projectiles
			if (this.projectileCount > 1) {
				const spread = this.spreadAngle / 2;
				angle += Math.random() * this.spreadAngle - spread;
			}

			const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

			// Create projectile starting from player position
			const position = this.player.getPosition().clone();
			position.y = 0.5; // Set y to match player height

			const projectile = new Projectile(
				this.scene,
				position,
				direction,
				this.projectileSpeed,
				this.projectileDamage
			);

			this.projectiles.push(projectile);
		}
	}

	public checkEnemyCollisions(enemies: Enemy[]): Enemy[] {
		const killedEnemies: Enemy[] = [];

		// Check each projectile against each enemy
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const projectile = this.projectiles[i];
			let hitEnemy = false;
			let shouldRemoveProjectile = true;

			for (const enemy of enemies) {
				if (enemy.isDead) continue;

				// Simple distance check for collision
				const distance = projectile.mesh.position.distanceTo(enemy.getPosition());
				if (distance < 1) {
					// Collision threshold
					let damage = projectile.damage;

					// Apply critical hit if enabled
					if (this.hasCriticalHits && Math.random() < this.criticalChance) {
						damage *= this.criticalMultiplier;
						this.showCriticalHitEffect(enemy.getPosition());
					}

					// Apply direct damage
					enemy.takeDamage(damage);

					// Apply poison damage if enabled
					if (this.hasPoisonDamage) {
						this.applyPoisonDamage(enemy);
					}

					hitEnemy = true;

					if (enemy.isDead) {
						killedEnemies.push(enemy);
					}

					// If we have piercing, continue to next enemy without removing projectile yet
					if (this.hasPiercing) {
						shouldRemoveProjectile = false;
						continue;
					}

					break;
				}
			}

			// Remove the projectile if it hit an enemy and doesn't have piercing, or if it hit with piercing
			if ((hitEnemy && shouldRemoveProjectile) || (hitEnemy && this.hasPiercing)) {
				projectile.cleanup();
				this.projectiles.splice(i, 1);
			}
		}

		return killedEnemies;
	}

	public upgrade(level?: number): void {
		// Use provided level for special upgrades if available
		if (level !== undefined) {
			// Special level-based upgrades
			this.projectileDamage = Math.max(100, level * 0.5);
			this.cooldownTime = Math.max(0.1, 0.5 - level * 0.02);
			this.projectileCount = Math.min(5, 1 + Math.floor(level / 3));
			this.spreadAngle = Math.min(Math.PI / 6, (this.projectileCount - 1) * 0.1);
			return;
		}

		// Regular incremental upgrade
		this.level++;

		// Every level, increase damage
		this.projectileDamage += 0.5;

		// Every 2 levels, decrease cooldown
		if (this.level % 2 === 0) {
			this.cooldownTime = Math.max(0.1, this.cooldownTime - 0.05);
		}

		// Every 3 levels, add a projectile
		if (this.level % 3 === 0) {
			this.projectileCount++;
			this.spreadAngle = Math.min(Math.PI / 6, (this.projectileCount - 1) * 0.1);
		}
	}

	// Getter for projectile damage
	public getProjectileDamage(): number {
		return this.projectileDamage;
	}

	// Setter for projectile damage
	public setProjectileDamage(value: number): void {
		this.projectileDamage = value;
	}

	// Getter for cooldown time
	public getCooldownTime(): number {
		return this.cooldownTime;
	}

	// Setter for cooldown time
	public setCooldownTime(value: number): void {
		this.cooldownTime = Math.max(0.1, value); // Minimum of 0.1 seconds
	}

	// Enable critical hits
	public enableCriticalHits(): void {
		this.hasCriticalHits = true;
		// If already enabled, increase chance or multiplier
		if (this.hasCriticalHits) {
			this.criticalChance = Math.min(0.5, this.criticalChance + 0.05);
			this.criticalMultiplier += 0.2;
		}
	}

	// Increase projectile count
	public increaseProjectileCount(count: number): void {
		this.projectileCount += count;
		this.spreadAngle = Math.min(Math.PI / 4, (this.projectileCount - 1) * 0.1);
	}

	// Increase projectile speed
	public increaseProjectileSpeed(percentage: number): void {
		this.projectileSpeed *= 1 + percentage;
	}

	// Enable piercing projectiles
	public enablePiercing(): void {
		this.hasPiercing = true;
	}

	// Enable poison damage
	public enablePoisonDamage(): void {
		this.hasPoisonDamage = true;
		// If already enabled, increase poison damage or duration
		if (this.hasPoisonDamage) {
			this.poisonDamage += 0.3;
			this.poisonDuration += 1;
		}
	}

	// Apply poison damage over time to an enemy
	private applyPoisonDamage(enemy: Enemy): void {
		if (enemy.isDead) return;

		// Apply poison visual effect
		const poisonEffect = this.createPoisonEffect();
		enemy.getMesh().add(poisonEffect);

		// Set up poison damage over time
		const interval = 0.5; // Damage every half second
		let totalDamage = 0;

		const applyDamage = () => {
			if (enemy.isDead || totalDamage >= this.poisonDuration * this.poisonDamage) {
				// Clean up poison effect if enemy still exists
				if (!enemy.isDead) {
					enemy.getMesh().remove(poisonEffect);
				}
				return;
			}

			// Apply damage
			const tickDamage = this.poisonDamage * interval;
			enemy.takeDamage(tickDamage);
			totalDamage += tickDamage;

			// Schedule next damage
			setTimeout(applyDamage, interval * 1000);
		};

		// Start poison damage
		applyDamage();

		// Clean up poison effect after duration
		setTimeout(() => {
			if (!enemy.isDead) {
				enemy.getMesh().remove(poisonEffect);
			}
		}, this.poisonDuration * 1000);
	}

	// Create poison visual effect
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

	// Show critical hit effect
	private showCriticalHitEffect(position: THREE.Vector3): void {
		// Create a flash effect for critical hits
		const geometry = new THREE.SphereGeometry(0.5, 16, 16);
		const material = new THREE.MeshBasicMaterial({
			color: 0xffff00,
			transparent: true,
			opacity: 0.8
		});

		const flash = new THREE.Mesh(geometry, material);
		flash.position.copy(position);
		flash.position.y += 0.5;
		this.scene.add(flash);

		// Animate flash expanding and fading
		const startTime = Date.now();
		const duration = 300; // ms

		const animateFlash = () => {
			const elapsed = Date.now() - startTime;
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

		// Show "CRIT!" text
		this.showCritText(position);
	}

	// Show critical hit text
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
			const startTime = Date.now();
			const duration = 1000; // ms

			const animateText = () => {
				const elapsed = Date.now() - startTime;
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
}

class Projectile {
	public mesh: THREE.Mesh;
	private scene: THREE.Scene;
	private direction: THREE.Vector3;
	private speed: number;
	public damage: number;
	private creationTime: number;

	constructor(
		scene: THREE.Scene,
		position: THREE.Vector3,
		direction: THREE.Vector3,
		speed: number,
		damage: number
	) {
		this.scene = scene;
		this.direction = direction;
		this.speed = speed;
		this.damage = damage;

		// Create projectile mesh (small yellow sphere)
		const geometry = new THREE.SphereGeometry(0.2, 8, 8);
		const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.copy(position);

		this.scene.add(this.mesh);

		this.creationTime = Date.now();
	}

	public update(delta: number): void {
		// Move projectile
		this.mesh.position.x += this.direction.x * this.speed * delta;
		this.mesh.position.z += this.direction.z * this.speed * delta;
	}

	public cleanup(): void {
		this.scene.remove(this.mesh);
	}

	public getLifetime(): number {
		return (Date.now() - this.creationTime) / 1000;
	}
}
