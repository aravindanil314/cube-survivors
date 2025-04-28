import * as THREE from 'three';
import { Collectible, CollectibleType } from './Collectible';
import { PlayerCharacter } from './PlayerCharacter';

export class CollectibleManager {
	private scene: THREE.Scene;
	private player: PlayerCharacter;
	private collectibles: Collectible[] = [];
	private attractionRadius: number = 5;
	private maxCollectibles: number = 100;

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

			// Check if player is close enough for attraction
			const distanceToPlayer = collectible.mesh.position.distanceTo(this.player.getPosition());
			if (distanceToPlayer < this.attractionRadius) {
				collectible.startAttraction(this.player);
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
}
