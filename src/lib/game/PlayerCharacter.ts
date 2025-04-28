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
	private hasShield: boolean = false;
	private healthRegenEnabled: boolean = false;
	private healthRegenTimer: number = 0;
	private healthRegenInterval: number = 5; // seconds between regeneration
	private healthRegenAmount: number = 1; // health per regen tick

	constructor(scene: THREE.Scene, boundarySize: number = 20) {
		this.scene = scene;
		this.boundarySize = boundarySize;
		this.mesh = this.createMesh();
		this.scene.add(this.mesh);
		this.weapon = new Weapon(this.scene, this);
	}

	private createMesh(): THREE.Group {
		const group = new THREE.Group();

		// Main body - create a cosmic core with glowing effect
		const bodyGeometry = new THREE.IcosahedronGeometry(0.5, 1);
		const bodyMaterial = new THREE.MeshStandardMaterial({
			color: 0x4facfe,
			emissive: 0x0066cc,
			emissiveIntensity: 0.5,
			metalness: 0.8,
			roughness: 0.2
		});
		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		body.position.y = 0.5;
		body.castShadow = true;

		// Add subtle rotation animation to body
		body.userData.rotationSpeed = 0.5;
		group.add(body);

		// Add a glow effect around the body
		const glowGeometry = new THREE.SphereGeometry(0.55, 32, 32);
		const glowMaterial = new THREE.MeshBasicMaterial({
			color: 0x00f2fe,
			transparent: true,
			opacity: 0.4,
			side: THREE.BackSide
		});
		const glow = new THREE.Mesh(glowGeometry, glowMaterial);
		glow.position.y = 0.5;
		group.add(glow);

		// Orbital ring around the player
		const ringGeometry = new THREE.TorusGeometry(0.8, 0.05, 16, 32);
		const ringMaterial = new THREE.MeshStandardMaterial({
			color: 0x4facfe,
			emissive: 0x00f2fe,
			emissiveIntensity: 0.5,
			transparent: true,
			opacity: 0.7
		});
		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.rotation.x = Math.PI / 2;
		ring.position.y = 0.5;
		// Add subtle rotation to ring
		ring.userData.rotationSpeed = 0.8;
		group.add(ring);

		// Add orbital particle effects - small spheres orbiting the player
		const orbCount = 3;
		for (let i = 0; i < orbCount; i++) {
			// Create a small glowing sphere
			const orbGeometry = new THREE.SphereGeometry(0.12, 16, 16);
			const orbMaterial = new THREE.MeshStandardMaterial({
				color: i % 2 === 0 ? 0x00f2fe : 0x4facfe,
				emissive: i % 2 === 0 ? 0x00f2fe : 0x4facfe,
				emissiveIntensity: 0.8,
				metalness: 0.9,
				roughness: 0.1
			});

			const orb = new THREE.Mesh(orbGeometry, orbMaterial);
			// Position orbs in a circle around the player
			const angle = (i / orbCount) * Math.PI * 2;
			orb.position.set(Math.cos(angle) * 0.8, 0.5, Math.sin(angle) * 0.8);

			// Store the initial angle for animation
			orb.userData.angle = angle;
			orb.userData.orbitSpeed = 1.2 + i * 0.4; // Different speeds for each orb
			orb.userData.orbitRadius = 0.8;
			orb.userData.orbitHeight = 0.5;

			group.add(orb);

			// Add a small point light to each orb for glow effect
			const orbLight = new THREE.PointLight(i % 2 === 0 ? 0x00f2fe : 0x4facfe, 0.5, 1.0);
			orbLight.position.copy(orb.position);
			orb.add(orbLight);
		}

		// Add a direction indicator (beam of light)
		const directionGeometry = new THREE.ConeGeometry(0.1, 0.6, 8);
		const directionMaterial = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			emissive: 0x00f2fe,
			emissiveIntensity: 0.8,
			transparent: true,
			opacity: 0.8
		});
		const direction = new THREE.Mesh(directionGeometry, directionMaterial);
		direction.rotation.x = Math.PI / 2;
		direction.position.set(0, 0.5, 0.9);
		group.add(direction);

		return group;
	}

	// Add a method to animate the cosmic effects
	private animateCosmicEffects(delta: number): void {
		if (!this.mesh) return;

		// Animate core body rotation
		const body = this.mesh.children[0] as THREE.Mesh;
		if (body.userData.rotationSpeed) {
			body.rotation.y += delta * body.userData.rotationSpeed;
			body.rotation.x += delta * body.userData.rotationSpeed * 0.7;
		}

		// Animate orbital ring
		const ring = this.mesh.children[2] as THREE.Mesh;
		if (ring.userData.rotationSpeed) {
			ring.rotation.z += delta * ring.userData.rotationSpeed;
		}

		// Animate orbiting particles
		for (let i = 3; i < this.mesh.children.length - 1; i++) {
			const orb = this.mesh.children[i] as THREE.Mesh;
			if (orb.userData.orbitSpeed) {
				// Update the angle
				orb.userData.angle += delta * orb.userData.orbitSpeed;

				// Calculate new position
				orb.position.x = Math.cos(orb.userData.angle) * orb.userData.orbitRadius;
				orb.position.z = Math.sin(orb.userData.angle) * orb.userData.orbitRadius;

				// Add some up/down movement
				orb.position.y = orb.userData.orbitHeight + Math.sin(orb.userData.angle * 2) * 0.1;
			}
		}
	}

	public update(delta: number, movement: { x: number; z: number }): void {
		// Update invulnerability timer
		if (this.isInvulnerable) {
			this.invulnerableTimer -= delta;
			if (this.invulnerableTimer <= 0) {
				this.isInvulnerable = false;
				// Reset body color - now using the cosmic theme colors
				const bodyMesh = this.mesh.children[0] as THREE.Mesh;
				const bodyMaterial = bodyMesh.material as THREE.MeshStandardMaterial;
				bodyMaterial.color.set(0x4facfe);
				bodyMaterial.emissive.set(0x0066cc);
			}
		}

		// Health regeneration if enabled
		if (this.healthRegenEnabled && !this.isDead) {
			this.healthRegenTimer += delta;
			if (this.healthRegenTimer >= this.healthRegenInterval) {
				this.heal(this.healthRegenAmount);
				this.healthRegenTimer = 0;
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

		// Animate cosmic effects
		this.animateCosmicEffects(delta);

		// Update weapon
		this.weapon.update(delta);

		// Update level-up particles if any
		this.updateLevelUpParticles();
	}

	private updateLevelUpParticles(): void {
		for (let i = this.levelUpParticles.length - 1; i >= 0; i--) {
			const particles = this.levelUpParticles[i];

			// Animate particles
			const positions = particles.geometry.attributes.position.array;
			let removeParticles = true;

			for (let j = 0; j < positions.length; j += 3) {
				// Move particles upward and outward
				positions[j] *= 1.03; // Expand outward X
				positions[j + 1] += 0.15; // Move up Y
				positions[j + 2] *= 1.03; // Expand outward Z

				// Fade out and shrink when high enough
				const material = particles.material as THREE.PointsMaterial;
				material.opacity -= 0.01;
				material.size *= 0.995;

				// If particles are still visible, don't remove yet
				if (material.opacity > 0.05) {
					removeParticles = false;
				}
			}

			particles.geometry.attributes.position.needsUpdate = true;

			// Remove particles when they're no longer visible
			if (removeParticles) {
				this.scene.remove(particles);

				// Properly dispose of geometry and materials to prevent memory leaks
				if (particles.geometry) {
					particles.geometry.dispose();
				}
				if (particles.material) {
					if (Array.isArray(particles.material)) {
						particles.material.forEach((material) => material.dispose());
					} else {
						particles.material.dispose();
					}
				}

				this.levelUpParticles.splice(i, 1);
			}
		}
	}

	public getPosition(): THREE.Vector3 {
		return this.mesh.position;
	}

	public takeDamage(amount: number): boolean {
		if (this.isInvulnerable) return false;

		// If shield is active, absorb the hit and disable shield
		if (this.hasShield) {
			this.hasShield = false;
			this.showShieldEffect();
			return false;
		}

		this.health = Math.max(0, this.health - amount);

		// Make player invulnerable briefly
		this.isInvulnerable = true;
		this.invulnerableTimer = this.invulnerableTime;

		// Flash the player white/red when taking damage
		const bodyMesh = this.mesh.children[0] as THREE.Mesh;
		const bodyMaterial = bodyMesh.material as THREE.MeshStandardMaterial;
		bodyMaterial.color.set(0xff3333);
		bodyMaterial.emissive.set(0xff0000);
		bodyMaterial.emissiveIntensity = 1.0;

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

	// Getter for the weapon
	public getWeapon(): Weapon {
		return this.weapon;
	}

	// Method to increase movement speed by a percentage
	public increaseSpeed(percentage: number): void {
		this.moveSpeed *= 1 + percentage;
	}

	// Method to set maximum health
	public setMaxHealth(value: number): void {
		this.maxHealth = value;
	}

	// Method to enable health regeneration
	public enableHealthRegen(): void {
		this.healthRegenEnabled = true;
		// If already enabled, increase regen rate or amount
		if (this.healthRegenEnabled) {
			this.healthRegenAmount += 1;
			this.healthRegenInterval = Math.max(1, this.healthRegenInterval * 0.8);
		}
	}

	// Method to add a shield
	public addShield(): void {
		this.hasShield = true;
		this.showShieldEffect();
	}

	// Visual effect for shield activation/deactivation
	private showShieldEffect(): void {
		// Create shield visual effect
		const shieldGeometry = new THREE.SphereGeometry(1, 32, 32);
		const shieldMaterial = new THREE.MeshBasicMaterial({
			color: 0x3399ff,
			transparent: true,
			opacity: 0.4,
			side: THREE.DoubleSide
		});

		const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
		shield.position.copy(this.mesh.position);
		shield.position.y = 0.5;
		this.scene.add(shield);

		// Animate shield effect
		const startTime = Date.now();
		const duration = 1000; // ms

		// Animate shield expanding and fading
		const animateShield = () => {
			const elapsed = Date.now() - startTime;
			const progress = elapsed / duration;

			if (progress < 1) {
				shield.scale.set(1 + progress, 1 + progress, 1 + progress);
				shieldMaterial.opacity = 0.4 * (1 - progress);
				requestAnimationFrame(animateShield);
			} else {
				this.scene.remove(shield);
			}
		};

		animateShield();
	}
}
