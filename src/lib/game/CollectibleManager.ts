import * as THREE from 'three';
import { Collectible, CollectibleType } from './Collectible';
import { PlayerCharacter } from './PlayerCharacter';

export class CollectibleManager {
	private scene: THREE.Scene;
	private player: PlayerCharacter;
	private collectibles: Collectible[] = [];
	private attractionRadius: number = 5;
	private maxCollectibles: number = 100;
	private magnetEnabled: boolean = false;
	private magnetRadius: number = 10; // Larger radius for magnet powerup

	constructor(scene: THREE.Scene, player: PlayerCharacter) {
		this.scene = scene;
		this.player = player;
	}

	public update(delta: number): void {
		// Update all collectibles
		for (let i = this.collectibles.length - 1; i >= 0; i--) {
			const collectible = this.collectibles[i];

			if (collectible.isCollected) {
				this.collectibles.splice(i, 1);
				continue;
			}

			collectible.update(delta);

			// Check if magnet is enabled for a larger attraction radius
			const checkRadius = this.magnetEnabled ? this.magnetRadius : this.attractionRadius;

			// Check if player is close enough for attraction
			const distanceToPlayer = collectible.mesh.position.distanceTo(this.player.getPosition());
			if (distanceToPlayer < checkRadius) {
				collectible.startAttraction(this.player);

				// If magnet is enabled, increase attraction speed
				if (this.magnetEnabled) {
					collectible.boostAttractionSpeed(2.0);
				}
			}
		}
	}

	public spawnCollectible(
		position: THREE.Vector3,
		type: CollectibleType = CollectibleType.EXPERIENCE,
		value: number = 1
	): void {
		// Don't spawn if we've reached the max
		if (this.collectibles.length >= this.maxCollectibles) return;

		// Add some randomness to position
		const randomOffset = 0.5;
		position = position.clone();
		position.x += (Math.random() * 2 - 1) * randomOffset;
		position.z += (Math.random() * 2 - 1) * randomOffset;

		const collectible = new Collectible(this.scene, position, type, value);
		this.collectibles.push(collectible);
	}

	public spawnExperienceAtPosition(position: THREE.Vector3, amount: number = 1): void {
		// Spawn multiple small experience orbs for larger amount values
		const numOrbs = Math.min(5, Math.max(1, Math.floor(amount / 5)));
		const valuePerOrb = Math.ceil(amount / numOrbs);

		for (let i = 0; i < numOrbs; i++) {
			this.spawnCollectible(position, CollectibleType.EXPERIENCE, valuePerOrb);
		}
	}

	public spawnHealthAtPosition(position: THREE.Vector3): void {
		// Health drops are more rare, so we set a higher value
		this.spawnCollectible(position, CollectibleType.HEALTH, 1);
	}

	public cleanup(): void {
		for (const collectible of this.collectibles) {
			collectible.cleanup();
		}
		this.collectibles = [];
	}

	// Enable item magnet powerup
	public enableMagnet(): void {
		this.magnetEnabled = true;
		this.magnetRadius = Math.min(20, this.magnetRadius + 3); // Increase radius with each powerup, max 20

		// Create visual magnet effect
		this.showMagnetActivationEffect();
	}

	// Visual effect for magnet activation
	private showMagnetActivationEffect(): void {
		// Create pulsing ring effect
		const ringGeometry = new THREE.RingGeometry(1, 1.2, 32);
		ringGeometry.rotateX(-Math.PI / 2);

		const ringMaterial = new THREE.MeshBasicMaterial({
			color: 0x4488ff,
			transparent: true,
			opacity: 0.7,
			side: THREE.DoubleSide
		});

		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.position.copy(this.player.getPosition());
		ring.position.y = 0.1;
		this.scene.add(ring);

		// Animate ring expanding and fading
		const startTime = Date.now();
		const duration = 1500; // ms

		const animateRing = () => {
			if (!this.player || this.player.isDead) {
				this.scene.remove(ring);
				return;
			}

			const elapsed = Date.now() - startTime;
			const progress = elapsed / duration;

			if (progress < 1) {
				// Update position to follow player
				ring.position.copy(this.player.getPosition());
				ring.position.y = 0.1;

				// Expand ring
				const scale = this.magnetRadius * progress;
				ring.scale.set(scale, scale, scale);

				// Fade out
				ringMaterial.opacity = 0.7 * (1 - progress);

				requestAnimationFrame(animateRing);
			} else {
				this.scene.remove(ring);
			}
		};

		animateRing();
	}

	// Add a method to get the current number of collectibles
	public getCollectibleCount(): number {
		return this.collectibles.length;
	}
}
