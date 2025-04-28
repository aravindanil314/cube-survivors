import * as THREE from 'three';
import { GameObject } from '../core/GameObject';
import { Debug } from '../utils/Debug';
import { PLAYER_CONFIG, VISUAL_CONFIG } from '../config';

/**
 * Class representing the player character
 */
export class PlayerCharacter extends GameObject {
	private health: number;
	private maxHealth: number;
	private moveSpeed: number;
	private level: number = 1;
	private experience: number = 0;
	private experienceToNextLevel: number;
	private isInvulnerable: boolean = false;
	private invulnerabilityTimer: number = 0;
	private boundarySize: number;
	private moveDirection: THREE.Vector3 = new THREE.Vector3();
	private debug: Debug;
	private powerups: Map<string, number> = new Map(); // Map of powerup id to level

	// Controls
	private keys: { [key: string]: boolean } = {};
	private isTouchDevice: boolean = false;
	private touchControls = {
		joystickActive: false,
		joystickOrigin: new THREE.Vector2(),
		joystickPosition: new THREE.Vector2()
	};

	constructor(scene: THREE.Scene, boundarySize: number, config = PLAYER_CONFIG) {
		super('player');

		this.boundarySize = boundarySize;
		this.health = config.health;
		this.maxHealth = config.maxHealth;
		this.moveSpeed = config.moveSpeed;
		this.experienceToNextLevel = config.baseXpRequirement;
		this.debug = Debug.getInstance();

		// Create player mesh
		this.createPlayerMesh();

		// Add to scene
		scene.add(this.object3D!);

		// Set up controls
		this.setupControls();

		this.debug.info('Player character initialized');
	}

	/**
	 * Create the player's visual representation
	 */
	private createPlayerMesh(): void {
		const group = new THREE.Group();

		// Player body
		const bodyGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
		const bodyMaterial = new THREE.MeshStandardMaterial({
			color: VISUAL_CONFIG.colors.player,
			emissive: VISUAL_CONFIG.colors.playerEmissive,
			emissiveIntensity: 0.5,
			metalness: 0.7,
			roughness: 0.3
		});

		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		body.position.y = 0.4; // Half height off ground
		body.castShadow = true;
		body.receiveShadow = true;
		group.add(body);

		// Add a point light to make player glow
		const light = new THREE.PointLight(VISUAL_CONFIG.colors.player, 0.7, 3);
		light.position.set(0, 0.5, 0);
		group.add(light);

		this.object3D = group;
		this.position.set(0, 0, 0);
		this.object3D.position.copy(this.position);
	}

	/**
	 * Set up keyboard and touch controls
	 */
	private setupControls(): void {
		// Keyboard controls
		window.addEventListener('keydown', (e) => {
			this.keys[e.key.toLowerCase()] = true;
		});

		window.addEventListener('keyup', (e) => {
			this.keys[e.key.toLowerCase()] = false;
		});

		// Check for touch device
		this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

		if (this.isTouchDevice) {
			this.setupTouchControls();
		}
	}

	/**
	 * Set up touch controls for mobile devices
	 */
	private setupTouchControls(): void {
		// Implementation would be added here
	}

	/**
	 * Update the player state
	 */
	update(deltaTime: number): void {
		if (!this.active) return;

		// Handle invulnerability
		if (this.isInvulnerable) {
			this.invulnerabilityTimer -= deltaTime;
			if (this.invulnerabilityTimer <= 0) {
				this.isInvulnerable = false;

				// Turn off visual effect for invulnerability
				const body = this.object3D!.children[0] as THREE.Mesh;
				const material = body.material as THREE.MeshStandardMaterial;
				material.opacity = 1.0;
				material.transparent = false;
			}
		}

		// Get input direction
		this.moveDirection.set(0, 0, 0);

		// Keyboard input
		if (this.keys['w'] || this.keys['arrowup']) this.moveDirection.z -= 1;
		if (this.keys['s'] || this.keys['arrowdown']) this.moveDirection.z += 1;
		if (this.keys['a'] || this.keys['arrowleft']) this.moveDirection.x -= 1;
		if (this.keys['d'] || this.keys['arrowright']) this.moveDirection.x += 1;

		// Touch input
		if (this.isTouchDevice && this.touchControls.joystickActive) {
			const joystickDelta = new THREE.Vector2()
				.subVectors(this.touchControls.joystickPosition, this.touchControls.joystickOrigin)
				.divideScalar(50); // Sensitivity

			this.moveDirection.x = joystickDelta.x;
			this.moveDirection.z = joystickDelta.y;
		}

		// Normalize for consistent movement in all directions
		if (this.moveDirection.lengthSq() > 0) {
			this.moveDirection.normalize();
		}

		// Apply movement
		this.velocity.copy(this.moveDirection).multiplyScalar(this.moveSpeed * deltaTime);
		this.position.add(this.velocity);

		// Enforce boundary
		this.position.x = Math.max(-this.boundarySize, Math.min(this.boundarySize, this.position.x));
		this.position.z = Math.max(-this.boundarySize, Math.min(this.boundarySize, this.position.z));

		// Update mesh position
		this.object3D!.position.copy(this.position);

		// Rotate to face movement direction
		if (this.moveDirection.lengthSq() > 0.1) {
			const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
			this.object3D!.rotation.y = angle;
		}
	}

	/**
	 * Handle taking damage
	 */
	takeDamage(amount: number): void {
		if (this.isInvulnerable) return;

		this.health -= amount;

		// Clamp health
		this.health = Math.max(0, this.health);

		// Visual feedback
		const body = this.object3D!.children[0] as THREE.Mesh;
		const originalMaterial = body.material as THREE.MeshStandardMaterial;

		// Make body flash red
		const flashMaterial = originalMaterial.clone();
		flashMaterial.color.set(0xff0000);
		body.material = flashMaterial;

		// Then return to normal
		setTimeout(() => {
			body.material = originalMaterial;
		}, 100);

		// Set invulnerability
		this.isInvulnerable = true;
		this.invulnerabilityTimer = PLAYER_CONFIG.invulnerabilityTime;

		// Visual effect for invulnerability
		originalMaterial.transparent = true;
		originalMaterial.opacity = 0.7;

		// Log damage
		this.debug.debug(`Player took ${amount} damage, health: ${this.health}/${this.maxHealth}`);

		// Check for death
		if (this.health <= 0) {
			this.die();
		}
	}

	/**
	 * Handle player death
	 */
	private die(): void {
		this.debug.info('Player died');

		// Dispatch game over event
		const gameOverEvent = new CustomEvent('gameOver');
		document.dispatchEvent(gameOverEvent);
	}

	/**
	 * Add experience points to the player
	 */
	addExperience(amount: number): void {
		this.experience += amount;

		// Check for level up
		if (this.experience >= this.experienceToNextLevel) {
			this.levelUp();
		}
	}

	/**
	 * Level up the player
	 */
	private levelUp(): void {
		this.level++;

		// Calculate new experience requirement using curve
		this.experienceToNextLevel = Math.floor(
			PLAYER_CONFIG.baseXpRequirement *
				Math.pow(PLAYER_CONFIG.levelScalingFactor, this.level - 1) *
				Math.pow(this.level, PLAYER_CONFIG.xpExponent)
		);

		// Reset experience to zero for new level
		this.experience = 0;

		// Increase max health by 10% per level
		const previousMaxHealth = this.maxHealth;
		this.maxHealth = Math.floor(PLAYER_CONFIG.maxHealth * (1 + 0.1 * (this.level - 1)));

		// Increase current health by the same amount
		this.health += this.maxHealth - previousMaxHealth;

		// Dispatch level up event
		const levelUpEvent = new CustomEvent('levelUp', {
			detail: { level: this.level }
		});
		document.dispatchEvent(levelUpEvent);

		this.debug.info(`Player leveled up to ${this.level}`);
	}

	/**
	 * Apply a powerup to the player
	 */
	applyPowerup(powerupId: string): void {
		// Get current powerup level (0 if not existing)
		const currentLevel = this.powerups.get(powerupId) || 0;

		// Increase powerup level
		this.powerups.set(powerupId, currentLevel + 1);

		// Apply effects based on powerup type
		switch (powerupId) {
			case 'damage': {
				// Increase damage
				// Implementation would depend on weapon system
				break;
			}
			case 'speed': {
				// Increase move speed by 10% per level
				this.moveSpeed *= 1.1;
				break;
			}
			case 'health': {
				// Increase max health by 20% per level
				this.maxHealth = Math.floor(this.maxHealth * 1.2);
				// Also heal to full
				this.health = this.maxHealth;
				break;
			}
			// Additional powerups would be implemented here
		}

		this.debug.info(`Applied powerup: ${powerupId} (Level ${currentLevel + 1})`);
	}

	/**
	 * Get current health
	 */
	getHealth(): number {
		return this.health;
	}

	/**
	 * Get maximum health
	 */
	getMaxHealth(): number {
		return this.maxHealth;
	}

	/**
	 * Get current level
	 */
	getLevel(): number {
		return this.level;
	}

	/**
	 * Get current experience
	 */
	getExperience(): number {
		return this.experience;
	}

	/**
	 * Get experience required for next level
	 */
	getExperienceToNextLevel(): number {
		return this.experienceToNextLevel;
	}

	/**
	 * Get the powerup level for a specific powerup
	 */
	getPowerupLevel(powerupId: string): number {
		return this.powerups.get(powerupId) || 0;
	}

	/**
	 * Clean up resources
	 */
	cleanup(): void {
		// Remove event listeners
		window.removeEventListener('keydown', () => {});
		window.removeEventListener('keyup', () => {});

		// Dispose of resources
		super.dispose();
	}
}
