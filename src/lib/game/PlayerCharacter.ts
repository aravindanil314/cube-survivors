import * as THREE from 'three';
import { Weapon } from './Weapon';
import { Enemy } from './Enemy';

export class PlayerCharacter {
	public mesh: THREE.Group;
	private scene: THREE.Scene;
	private moveSpeed: number = 5;
	private boundarySize: number;
	private health: number = 100;
	private maxHealth: number = 100;
	private weapon: Weapon;
	private isInvulnerable: boolean = false;
	private invulnerableTime: number = 0.5; // seconds
	private invulnerableTimer: number = 0;
	private experience: number = 0;
	private level: number = 1;
	private experienceToNextLevel: number = 10; // Reduced from 20 to 10 for faster initial leveling
	private readonly baseXpRequirement: number = 10; // Reduced from 20 to 10
	private readonly levelScalingFactor: number = 1.2; // Reduced from 1.5 to 1.2 for slower scaling
	private readonly xpExponent: number = 1.1; // Reduced from 1.2 to 1.1 for more linear progression
	private readonly levelBonuses: { [key: number]: string } = {
		2: 'Increased Attack Speed',
		3: 'Increased Attack Damage',
		5: 'Double Projectiles',
		7: 'Increased Attack Range',
		10: 'Ultimate Weapon Upgrade',
		15: 'Triple Projectiles',
		20: 'Maximum Power'
	};
	private levelUpParticles: THREE.Points[] = [];
	public isDead: boolean = false;

	constructor(scene: THREE.Scene, boundarySize: number = 20) {
		this.scene = scene;
		this.boundarySize = boundarySize;
		this.mesh = this.createMesh();
		this.scene.add(this.mesh);
		this.weapon = new Weapon(this.scene, this);
	}

	private createMesh(): THREE.Group {
		const group = new THREE.Group();

		// Body - blue cube
		const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);
		const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3498db });
		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		body.position.y = 0.5;
		body.castShadow = true;
		group.add(body);

		// Head - smaller red cube on top
		const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
		const headMaterial = new THREE.MeshStandardMaterial({ color: 0xe74c3c });
		const head = new THREE.Mesh(headGeometry, headMaterial);
		head.position.y = 1.3;
		head.castShadow = true;
		group.add(head);

		// Add direction indicator (small cylinder pointing forward)
		const directionGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5);
		const directionMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
		const direction = new THREE.Mesh(directionGeometry, directionMaterial);
		direction.rotation.x = Math.PI / 2;
		direction.position.set(0, 0.5, 0.75);
		group.add(direction);

		return group;
	}

	public update(delta: number, movement: { x: number; z: number }): void {
		// Update invulnerability timer
		if (this.isInvulnerable) {
			this.invulnerableTimer -= delta;
			if (this.invulnerableTimer <= 0) {
				this.isInvulnerable = false;
				// Reset body color
				const bodyMesh = this.mesh.children[0] as THREE.Mesh;
				const bodyMaterial = bodyMesh.material as THREE.MeshStandardMaterial;
				bodyMaterial.color.set(0x3498db);
			}
		}

		// Calculate new position with boundary checks
		const newX = this.mesh.position.x + movement.x * this.moveSpeed * delta;
		const newZ = this.mesh.position.z + movement.z * this.moveSpeed * delta;

		// Apply boundary limits
		this.mesh.position.x = Math.max(-this.boundarySize, Math.min(this.boundarySize, newX));
		this.mesh.position.z = Math.max(-this.boundarySize, Math.min(this.boundarySize, newZ));

		// Rotate player to face movement direction
		if (movement.x !== 0 || movement.z !== 0) {
			const angle = Math.atan2(movement.x, movement.z);
			this.mesh.rotation.y = angle;
		}

		// Update weapon
		this.weapon.update(delta);

		// Update level-up particles if any
		this.updateLevelUpParticles(delta);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private updateLevelUpParticles(delta: number): void {
		for (let i = this.levelUpParticles.length - 1; i >= 0; i--) {
			const particles = this.levelUpParticles[i];
			const positions = particles.geometry.attributes.position.array;

			// Move particles upward and outward
			for (let j = 0; j < positions.length; j += 3) {
				positions[j] *= 1.01; // Expand X
				positions[j + 1] += 0.1; // Move up
				positions[j + 2] *= 1.01; // Expand Z
			}

			particles.geometry.attributes.position.needsUpdate = true;

			// Remove particles after they've expanded enough
			if (positions[1] > 10) {
				this.scene.remove(particles);
				this.levelUpParticles.splice(i, 1);
			}
		}
	}

	public getPosition(): THREE.Vector3 {
		return this.mesh.position;
	}

	public takeDamage(amount: number): boolean {
		if (this.isInvulnerable) return false;

		this.health = Math.max(0, this.health - amount);

		// Make player invulnerable briefly
		this.isInvulnerable = true;
		this.invulnerableTimer = this.invulnerableTime;

		// Flash the player white when taking damage
		const bodyMesh = this.mesh.children[0] as THREE.Mesh;
		const bodyMaterial = bodyMesh.material as THREE.MeshStandardMaterial;
		bodyMaterial.color.set(0xffffff);

		// Set isDead if health is zero
		if (this.health <= 0) {
			this.isDead = true;
		}

		return this.health <= 0;
	}

	public heal(amount: number): void {
		this.health = Math.min(this.maxHealth, this.health + amount);
	}

	public addExperience(amount: number): boolean {
		this.experience += amount;

		if (this.experience >= this.experienceToNextLevel) {
			this.levelUp();
			return true;
		}

		return false;
	}

	public levelUp(): void {
		const oldRequirement = this.experienceToNextLevel;
		const excess = this.experience - oldRequirement;

		this.level++;
		this.maxHealth += 10;
		this.health = this.maxHealth;

		// Calculate XP needed for next level
		this.experienceToNextLevel = Math.floor(
			this.baseXpRequirement *
				(Math.pow(this.level, this.xpExponent) * Math.pow(this.levelScalingFactor, this.level / 3))
		);

		// Carry over excess XP to the next level
		this.experience = Math.max(0, excess);

		// If we have a weapon, upgrade it with the player's level
		if (this.weapon) {
			this.weapon.upgrade(this.level);
		}

		// Create level up visual effect with particles
		this.createLevelUpParticles();
	}

	private createLevelUpParticles(): void {
		const particleCount = 100; // Increased from 50 to 100 particles
		const particleGeometry = new THREE.BufferGeometry();
		const particlePositions = new Float32Array(particleCount * 3);

		// Create particles in a spiral pattern around the player
		for (let i = 0; i < particleCount; i++) {
			const t = i / particleCount;
			const angle = t * Math.PI * 6; // More rotations for spiral effect
			const radius = 1.5 + t * 2; // Increasing radius for spiral

			particlePositions[i * 3] = Math.sin(angle) * radius;
			particlePositions[i * 3 + 1] = t * 2; // Start at varying heights
			particlePositions[i * 3 + 2] = Math.cos(angle) * radius;
		}

		particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

		// Create more vibrant glowing particle material
		const particleMaterial = new THREE.PointsMaterial({
			color: 0x00ffff,
			size: 0.4, // Larger particles
			transparent: true,
			blending: THREE.AdditiveBlending,
			opacity: 1.0 // Fully opaque
		});

		const particles = new THREE.Points(particleGeometry, particleMaterial);
		particles.position.copy(this.mesh.position);
		this.scene.add(particles);

		// Add a second particle system with different color for more flair
		const secondParticleGeometry = new THREE.BufferGeometry();
		const secondParticlePositions = new Float32Array(particleCount * 3);

		// Create particles in an expanding ring
		for (let i = 0; i < particleCount; i++) {
			const angle = (i / particleCount) * Math.PI * 2;
			const radius = 2;

			secondParticlePositions[i * 3] = Math.sin(angle) * radius;
			secondParticlePositions[i * 3 + 1] = 0.1; // Low to the ground
			secondParticlePositions[i * 3 + 2] = Math.cos(angle) * radius;
		}

		secondParticleGeometry.setAttribute(
			'position',
			new THREE.BufferAttribute(secondParticlePositions, 3)
		);

		// Gold particle material
		const secondParticleMaterial = new THREE.PointsMaterial({
			color: 0xffdd00,
			size: 0.3,
			transparent: true,
			blending: THREE.AdditiveBlending,
			opacity: 0.9
		});

		const secondParticles = new THREE.Points(secondParticleGeometry, secondParticleMaterial);
		secondParticles.position.copy(this.mesh.position);
		this.scene.add(secondParticles);

		// Add both particle systems to our tracked particles for animation
		this.levelUpParticles.push(particles);
		this.levelUpParticles.push(secondParticles);

		// Flash the player cube with rainbow colors briefly
		const bodyMesh = this.mesh.children[0] as THREE.Mesh;
		const bodyMaterial = bodyMesh.material as THREE.MeshStandardMaterial;

		// Save original color
		const originalColor = bodyMaterial.color.clone();

		// Flash sequence of colors
		const flashColors = [0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff];
		const flashInterval = 100; // ms

		flashColors.forEach((color, index) => {
			setTimeout(() => {
				if (!this.isDead) {
					bodyMaterial.color.set(color);
					bodyMaterial.emissive = new THREE.Color(color);
					bodyMaterial.emissiveIntensity = 0.5;
				}

				// Reset after the last color
				if (index === flashColors.length - 1) {
					setTimeout(() => {
						if (!this.isDead) {
							bodyMaterial.color.copy(originalColor);
							bodyMaterial.emissive = new THREE.Color(0x000000);
							bodyMaterial.emissiveIntensity = 0;
						}
					}, flashInterval);
				}
			}, index * flashInterval);
		});
	}

	public getHealth(): number {
		return this.health;
	}

	public getMaxHealth(): number {
		return this.maxHealth;
	}

	public getLevel(): number {
		return this.level;
	}

	public getExperience(): number {
		return this.experience;
	}

	public getExperienceToNextLevel(): number {
		return this.experienceToNextLevel;
	}

	// Calculate total XP needed for a specific level (for UI display)
	public getTotalXpForLevel(targetLevel: number): number {
		if (targetLevel <= 1) return 0;

		let totalXp = 0;
		for (let lvl = 1; lvl < targetLevel; lvl++) {
			totalXp += Math.floor(
				this.baseXpRequirement *
					(Math.pow(lvl, this.xpExponent) * Math.pow(this.levelScalingFactor, lvl / 3))
			);
		}

		return totalXp;
	}

	public attack(): void {
		this.weapon.fire();
	}

	public checkWeaponCollisions(enemies: Enemy[]): Enemy[] {
		return this.weapon.checkEnemyCollisions(enemies);
	}
}
