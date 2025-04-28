import * as THREE from 'three';
import { PlayerCharacter } from './PlayerCharacter';

export enum EnemyType {
	MELEE = 'melee',
	RANGED = 'ranged',
	BOSS = 'boss'
}

export abstract class Enemy {
	public mesh: THREE.Group;
	protected scene: THREE.Scene;
	protected target: PlayerCharacter;
	protected speed: number;
	protected health: number;
	public isDead: boolean = false;
	protected moveDirection: THREE.Vector3 = new THREE.Vector3();
	protected type: EnemyType;
	protected healthDropChance: number = 0.1; // Default health drop chance
	protected isBoss: boolean = false;

	constructor(
		scene: THREE.Scene,
		position: THREE.Vector3,
		target: PlayerCharacter,
		type: EnemyType,
		speed: number,
		health: number
	) {
		this.scene = scene;
		this.target = target;
		this.speed = speed;
		this.health = health;
		this.type = type;
		this.mesh = this.createMesh();
		this.mesh.position.copy(position);
		this.scene.add(this.mesh);
	}

	protected abstract createMesh(): THREE.Group;

	public update(delta: number): void {
		if (this.isDead) return;

		this.updateMovement(delta);
		this.updateAttack(delta);
	}

	protected updateMovement(delta: number): void {
		// Calculate direction to player
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position).normalize();

		// Move toward player
		this.mesh.position.x += this.moveDirection.x * this.speed * delta;
		this.mesh.position.z += this.moveDirection.z * this.speed * delta;

		// Rotate to face player
		const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
		this.mesh.rotation.y = angle;
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

	public cleanup(): void {
		this.scene.remove(this.mesh);
	}
}

export class MeleeEnemy extends Enemy {
	private attackCooldown: number = 0;
	private readonly attackRange: number = 1.2;

	constructor(scene: THREE.Scene, position: THREE.Vector3, target: PlayerCharacter) {
		super(scene, position, target, EnemyType.MELEE, 1.8 + Math.random() * 0.5, 3);
		this.healthDropChance = 0.15; // 15% chance to drop health
	}

	protected createMesh(): THREE.Group {
		const group = new THREE.Group();

		// Enemy body - red crystal structure
		const bodyGeometry = new THREE.OctahedronGeometry(0.4, 1);
		const bodyMaterial = new THREE.MeshStandardMaterial({
			color: 0xff3333,
			emissive: 0xaa0000,
			emissiveIntensity: 0.7,
			metalness: 0.7,
			roughness: 0.3
		});
		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		body.position.y = 0.4;
		body.castShadow = true;
		group.add(body);

		// Create a halo/aura around the enemy
		const auraGeometry = new THREE.SphereGeometry(0.5, 16, 16);
		const auraMaterial = new THREE.MeshBasicMaterial({
			color: 0xff3333,
			transparent: true,
			opacity: 0.3,
			side: THREE.BackSide
		});
		const aura = new THREE.Mesh(auraGeometry, auraMaterial);
		aura.position.y = 0.4;
		group.add(aura);

		// Add sharp spikes on the enemy's body
		const spikeCount = 4;
		for (let i = 0; i < spikeCount; i++) {
			const angle = (i / spikeCount) * Math.PI * 2;
			const spikeGeometry = new THREE.ConeGeometry(0.08, 0.5, 4);
			const spikeMaterial = new THREE.MeshStandardMaterial({
				color: 0xff6666,
				emissive: 0xff3333,
				emissiveIntensity: 0.5
			});

			const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
			// Position around the body
			spike.position.set(Math.cos(angle) * 0.3, 0.4, Math.sin(angle) * 0.3);
			// Rotate to point outward
			spike.rotation.z = Math.PI / 2;
			spike.rotation.y = -angle;

			group.add(spike);
		}

		// Add a small red point light for glow effect
		const light = new THREE.PointLight(0xff0000, 0.5, 2);
		light.position.set(0, 0.4, 0);
		group.add(light);

		return group;
	}

	protected updateAttack(delta: number): void {
		// Reduce cooldown timer
		if (this.attackCooldown > 0) {
			this.attackCooldown -= delta;
		}

		// Check if in range and cooldown is finished
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());
		if (distanceToPlayer <= this.attackRange && this.attackCooldown <= 0) {
			// Attack the player
			this.target.takeDamage(1);

			// Reset cooldown
			this.attackCooldown = 1.0; // 1 second between attacks

			// Visual feedback for attack
			this.showAttackAnimation();
		}
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
}

export class RangedEnemy extends Enemy {
	private projectiles: THREE.Mesh[] = [];
	private shootCooldown: number = 0;
	private readonly preferredDistance: number = 8; // Distance they try to maintain from player
	private readonly shootRange: number = 12; // Max range they can shoot from

	constructor(scene: THREE.Scene, position: THREE.Vector3, target: PlayerCharacter) {
		super(scene, position, target, EnemyType.RANGED, 1.2 + Math.random() * 0.3, 2);
		this.shootCooldown = Math.random() * 2; // Randomize initial cooldown
		this.healthDropChance = 0.25; // 25% chance to drop health
	}

	protected createMesh(): THREE.Group {
		const group = new THREE.Group();

		// Enemy body - cosmic energy sphere
		const bodyGeometry = new THREE.SphereGeometry(0.35, 16, 16);
		const bodyMaterial = new THREE.MeshStandardMaterial({
			color: 0x9933ff,
			emissive: 0x6600cc,
			emissiveIntensity: 0.8,
			metalness: 0.9,
			roughness: 0.2,
			transparent: true,
			opacity: 0.9
		});
		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		body.position.y = 0.35;
		body.castShadow = true;
		group.add(body);

		// Add energy rings around the body
		const ringGeometry = new THREE.TorusGeometry(0.5, 0.04, 8, 24);
		const ringMaterial = new THREE.MeshStandardMaterial({
			color: 0xcc66ff,
			emissive: 0xaa33ff,
			emissiveIntensity: 0.7,
			transparent: true,
			opacity: 0.7
		});

		// Create three rings in different orientations
		const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
		ring1.position.y = 0.35;
		group.add(ring1);

		const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
		ring2.rotation.x = Math.PI / 2;
		ring2.position.y = 0.35;
		group.add(ring2);

		const ring3 = new THREE.Mesh(ringGeometry, ringMaterial);
		ring3.rotation.z = Math.PI / 2;
		ring3.position.y = 0.35;
		group.add(ring3);

		// Add small energy sparks around the enemy
		for (let i = 0; i < 5; i++) {
			const sparkGeometry = new THREE.SphereGeometry(0.06, 8, 8);
			const sparkMaterial = new THREE.MeshBasicMaterial({
				color: 0xcc66ff,
				transparent: true,
				opacity: 0.9
			});

			const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
			// Position randomly around the body
			const angle = Math.random() * Math.PI * 2;
			const radius = 0.4 + Math.random() * 0.3;
			spark.position.set(
				Math.cos(angle) * radius,
				0.35 + (Math.random() * 0.3 - 0.15),
				Math.sin(angle) * radius
			);

			// Store animation data
			spark.userData.angle = angle;
			spark.userData.radius = radius;
			spark.userData.speed = 1 + Math.random() * 2;
			spark.userData.offset = Math.random() * Math.PI * 2;

			group.add(spark);

			// Add a small point light for each spark
			const sparkLight = new THREE.PointLight(0xcc66ff, 0.3, 1);
			sparkLight.position.copy(spark.position);
			spark.add(sparkLight);
		}

		// Add a purple point light for overall glow
		const light = new THREE.PointLight(0x9933ff, 0.7, 3);
		light.position.set(0, 0.35, 0);
		group.add(light);

		return group;
	}

	protected updateMovement(delta: number): void {
		// Calculate direction and distance to player
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position);
		const distanceToPlayer = this.moveDirection.length();
		this.moveDirection.normalize();

		// If too close to the player, move away
		if (distanceToPlayer < this.preferredDistance - 1) {
			this.mesh.position.x -= this.moveDirection.x * this.speed * delta;
			this.mesh.position.z -= this.moveDirection.z * this.speed * delta;
		}
		// If too far from the player, move closer
		else if (distanceToPlayer > this.preferredDistance + 1) {
			this.mesh.position.x += this.moveDirection.x * this.speed * delta;
			this.mesh.position.z += this.moveDirection.z * this.speed * delta;
		}
		// If at a good distance, move sideways to avoid being hit
		else {
			// Create a perpendicular vector for strafing
			const strafeDir = new THREE.Vector3(-this.moveDirection.z, 0, this.moveDirection.x);
			strafeDir.multiplyScalar(Math.sin(Date.now() * 0.001) * this.speed * delta);

			this.mesh.position.add(strafeDir);
		}

		// Always face the player
		const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
		this.mesh.rotation.y = angle;

		// Update projectile positions
		this.updateProjectiles(delta);
	}

	protected updateAttack(delta: number): void {
		// Reduce cooldown timer
		if (this.shootCooldown > 0) {
			this.shootCooldown -= delta;
		}

		// Check if in range and cooldown is finished
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());
		if (distanceToPlayer <= this.shootRange && this.shootCooldown <= 0) {
			this.shoot();
			this.shootCooldown = 3.0; // 3 seconds between shots
		}
	}

	private shoot(): void {
		// Create projectile
		const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
		const projectileMaterial = new THREE.MeshBasicMaterial({
			color: 0xff00ff,
			transparent: true,
			opacity: 0.8
		});

		const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

		// Set initial position (slightly in front of the enemy)
		const offset = this.moveDirection.clone().multiplyScalar(0.8);
		projectile.position.copy(this.mesh.position.clone().add(offset));
		projectile.position.y = 0.5; // Match height with player

		// Add to scene and list
		this.scene.add(projectile);

		// Store direction and other properties with the projectile
		const userData = {
			direction: this.moveDirection.clone(),
			speed: 5, // Faster than the enemy
			damage: 1,
			lifetime: 4, // Seconds before disappearing
			timeLived: 0
		};

		// Store the data on the projectile's userData
		projectile.userData = userData;

		// Add to the list of active projectiles
		this.projectiles.push(projectile);
	}

	private updateProjectiles(delta: number): void {
		// Process each projectile
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const projectile = this.projectiles[i];
			const userData = projectile.userData;

			// Move the projectile
			projectile.position.x += userData.direction.x * userData.speed * delta;
			projectile.position.z += userData.direction.z * userData.speed * delta;

			// Add a slight bobbing effect
			projectile.position.y = 0.5 + Math.sin(userData.timeLived * 5) * 0.1;

			// Update lifetime
			userData.timeLived += delta;

			// Check collision with player
			const distanceToPlayer = projectile.position.distanceTo(this.target.getPosition());
			if (distanceToPlayer < 0.7) {
				// Collision radius
				// Damage player
				this.target.takeDamage(userData.damage);

				// Remove projectile
				this.scene.remove(projectile);
				this.projectiles.splice(i, 1);
				continue;
			}

			// Check if projectile has lived its full lifetime
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

		// Clean up projectiles when enemy dies
		this.cleanup();
	}

	public update(delta: number): void {
		if (this.isDead) return;

		super.update(delta);

		// Animate rings rotation
		const rings = [
			this.mesh.children[1] as THREE.Mesh,
			this.mesh.children[2] as THREE.Mesh,
			this.mesh.children[3] as THREE.Mesh
		];

		rings[0].rotation.z += delta * 0.8;
		rings[1].rotation.y += delta * 0.6;
		rings[2].rotation.x += delta * 0.7;

		// Animate energy sparks
		for (let i = 4; i < this.mesh.children.length - 1; i++) {
			const spark = this.mesh.children[i] as THREE.Mesh;
			if (spark.userData.speed) {
				spark.userData.angle += delta * spark.userData.speed;

				// Update position with a spiraling motion
				spark.position.x = Math.cos(spark.userData.angle) * spark.userData.radius;
				spark.position.z = Math.sin(spark.userData.angle) * spark.userData.radius;

				// Add bobbing motion
				spark.position.y = 0.35 + Math.sin(spark.userData.angle + spark.userData.offset) * 0.15;

				// Pulsate size slightly
				const scale = 0.8 + Math.sin(spark.userData.angle * 3) * 0.2;
				spark.scale.set(scale, scale, scale);
			}
		}
	}
}

export class BossEnemy extends Enemy {
	private attackCooldown: number = 0;
	private specialAttackCooldown: number = 0;
	private readonly attackRange: number = 2.0;
	private specialAttackTime: number = 0;
	private isDoingSpecialAttack: boolean = false;
	private projectiles: THREE.Mesh[] = [];
	private specialProjectiles: THREE.Mesh[] = [];
	private rotationAngle: number = 0;
	private readonly attackPhases = ['melee', 'ranged', 'special'];
	private currentPhase: number = 0;
	private phaseTimer: number = 0;
	private readonly phaseDuration: number = 10; // 10 seconds per phase

	constructor(scene: THREE.Scene, position: THREE.Vector3, target: PlayerCharacter) {
		super(scene, position, target, EnemyType.BOSS, 1.5, 50);
		this.healthDropChance = 1.0; // 100% chance to drop health when killed
		this.isBoss = true;
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
		// Move toward player
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position).normalize();
		this.mesh.position.x += this.moveDirection.x * this.speed * 1.2 * delta;
		this.mesh.position.z += this.moveDirection.z * this.speed * 1.2 * delta;

		// Rotate to face player
		const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
		this.mesh.rotation.y = angle;

		// Attack if in range
		if (this.attackCooldown > 0) {
			this.attackCooldown -= delta;
		}

		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());
		if (distanceToPlayer <= this.attackRange && this.attackCooldown <= 0) {
			// Strong melee attack
			this.target.takeDamage(2);
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
			this.mesh.position.x -= this.moveDirection.x * this.speed * delta;
			this.mesh.position.z -= this.moveDirection.z * this.speed * delta;
		} else if (distanceToPlayer > preferredDistance + 2) {
			this.mesh.position.x += this.moveDirection.x * this.speed * delta;
			this.mesh.position.z += this.moveDirection.z * this.speed * delta;
		} else {
			// Strafe sideways
			const strafeDir = new THREE.Vector3(-this.moveDirection.z, 0, this.moveDirection.x);
			strafeDir.multiplyScalar(Math.sin(Date.now() * 0.001) * this.speed * delta);
			this.mesh.position.add(strafeDir);
		}

		// Face player
		const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
		this.mesh.rotation.y = angle;

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

		// Move slower during special phase
		this.moveDirection.subVectors(this.target.getPosition(), this.mesh.position).normalize();
		this.mesh.position.x += this.moveDirection.x * this.speed * 0.5 * delta;
		this.mesh.position.z += this.moveDirection.z * this.speed * 0.5 * delta;

		// Spin around
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

		// Damage player if in range
		const distanceToPlayer = this.mesh.position.distanceTo(this.target.getPosition());
		if (distanceToPlayer < 5) {
			this.target.takeDamage(3);
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

		// Store direction and other properties
		const userData = {
			direction: direction,
			speed: 6,
			damage: damage,
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
		this.cleanup();
	}
}
