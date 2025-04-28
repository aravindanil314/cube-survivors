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
	private projectileDamage: number = 1;
	private projectileCount: number = 1;
	private spreadAngle: number = 0;
	private level: number = 1;

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

			// Remove projectiles that are out of bounds
			if (Math.abs(projectile.mesh.position.x) > 30 || Math.abs(projectile.mesh.position.z) > 30) {
				projectile.cleanup();
				this.projectiles.splice(i, 1);
			}
		}
	}

	public fire(): void {
		if (this.cooldownTimer > 0) return;

		// Reset cooldown
		this.cooldownTimer = this.cooldownTime;

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

			for (const enemy of enemies) {
				if (enemy.isDead) continue;

				// Simple distance check for collision
				const distance = projectile.mesh.position.distanceTo(enemy.getPosition());
				if (distance < 1) {
					// Collision threshold
					enemy.takeDamage(projectile.damage);
					hitEnemy = true;

					if (enemy.isDead) {
						killedEnemies.push(enemy);
					}

					break;
				}
			}

			if (hitEnemy) {
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
			this.projectileDamage = Math.max(1, level * 0.5);
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
}

class Projectile {
	public mesh: THREE.Mesh;
	private scene: THREE.Scene;
	private direction: THREE.Vector3;
	private speed: number;
	public damage: number;

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
	}

	public update(delta: number): void {
		// Move projectile
		this.mesh.position.x += this.direction.x * this.speed * delta;
		this.mesh.position.z += this.direction.z * this.speed * delta;
	}

	public cleanup(): void {
		this.scene.remove(this.mesh);
	}
}
