import * as THREE from 'three';
import { PlayerCharacter } from './PlayerCharacter';

export enum CollectibleType {
	EXPERIENCE,
	HEALTH
}

export class Collectible {
	public mesh: THREE.Mesh;
	private scene: THREE.Scene;
	private type: CollectibleType;
	private value: number;
	public isCollected: boolean = false;
	private rotationSpeed: number = 2;
	private attractionSpeed: number = 0;
	private maxAttractionSpeed: number = 10;
	private attractionAcceleration: number = 5;
	private target: PlayerCharacter | null = null;

	constructor(
		scene: THREE.Scene,
		position: THREE.Vector3,
		type: CollectibleType,
		value: number = 1
	) {
		this.scene = scene;
		this.type = type;
		this.value = value;
		this.mesh = this.createMesh();
		this.mesh.position.copy(position);
		this.mesh.position.y = 0.5; // Float slightly above ground
		this.scene.add(this.mesh);
	}

	private createMesh(): THREE.Mesh {
		let geometry: THREE.BufferGeometry;
		let material: THREE.Material;

		switch (this.type) {
			case CollectibleType.EXPERIENCE:
				// Blue diamond for experience
				geometry = new THREE.OctahedronGeometry(0.3);
				material = new THREE.MeshStandardMaterial({
					color: 0x3498db,
					emissive: 0x3498db,
					emissiveIntensity: 0.5
				});
				break;

			case CollectibleType.HEALTH:
				// Red cube for health
				geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
				material = new THREE.MeshStandardMaterial({
					color: 0xe74c3c,
					emissive: 0xe74c3c,
					emissiveIntensity: 0.5
				});
				break;

			default:
				// Default small sphere
				geometry = new THREE.SphereGeometry(0.3);
				material = new THREE.MeshStandardMaterial({ color: 0xffffff });
		}

		return new THREE.Mesh(geometry, material);
	}

	public update(delta: number): void {
		if (this.isCollected) return;

		// Rotate the collectible
		this.mesh.rotation.y += this.rotationSpeed * delta;

		// Make it float up and down slightly
		this.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003) * 0.1;

		// If being attracted to player, move toward them
		if (this.target) {
			// Accelerate attraction speed
			this.attractionSpeed = Math.min(
				this.maxAttractionSpeed,
				this.attractionSpeed + this.attractionAcceleration * delta
			);

			// Get direction to player
			const playerPosition = this.target.getPosition();
			const direction = new THREE.Vector3()
				.subVectors(playerPosition, this.mesh.position)
				.normalize();

			// Move toward player
			this.mesh.position.x += direction.x * this.attractionSpeed * delta;
			this.mesh.position.z += direction.z * this.attractionSpeed * delta;

			// Check if collected
			const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);
			if (distanceToPlayer < 1) {
				this.collect();
			}
		}
	}

	public startAttraction(target: PlayerCharacter): void {
		this.target = target;
		this.attractionSpeed = Math.max(this.attractionSpeed, 0.5); // Start with at least some speed
	}

	// Method to boost attraction speed for Item Magnet powerup
	public boostAttractionSpeed(multiplier: number): void {
		this.maxAttractionSpeed *= multiplier;
		this.attractionAcceleration *= multiplier;
		this.attractionSpeed = Math.max(this.attractionSpeed, this.maxAttractionSpeed / 2);
	}

	private collect(): void {
		if (this.isCollected || !this.target) return;

		this.isCollected = true;
		this.scene.remove(this.mesh);

		// Apply effect based on type
		switch (this.type) {
			case CollectibleType.EXPERIENCE:
				// Increase XP value by 3x
				this.target.addExperience(this.value * 3);

				// Create a visual effect at collection point
				this.createCollectionEffect(0x3498db); // Blue for XP
				break;

			case CollectibleType.HEALTH:
				this.target.heal(this.value * 10);

				// Create a visual effect at collection point
				this.createCollectionEffect(0xe74c3c); // Red for health
				break;
		}
	}

	private createCollectionEffect(color: number): void {
		// Create a simple flash particle effect
		const particleCount = 10;
		const particleGeometry = new THREE.BufferGeometry();
		const particlePositions = new Float32Array(particleCount * 3);

		// Create particles in a small sphere
		for (let i = 0; i < particleCount; i++) {
			const angle1 = Math.random() * Math.PI * 2;
			const angle2 = Math.random() * Math.PI * 2;
			const radius = 0.3;

			particlePositions[i * 3] = Math.sin(angle1) * Math.cos(angle2) * radius;
			particlePositions[i * 3 + 1] = Math.sin(angle1) * Math.sin(angle2) * radius;
			particlePositions[i * 3 + 2] = Math.cos(angle1) * radius;
		}

		particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

		// Create glowing particle material
		const particleMaterial = new THREE.PointsMaterial({
			color: color,
			size: 0.2,
			transparent: true,
			blending: THREE.AdditiveBlending,
			opacity: 1.0
		});

		const particles = new THREE.Points(particleGeometry, particleMaterial);
		particles.position.copy(this.mesh.position);
		this.scene.add(particles);

		// Animate and remove after a short time
		const startTime = Date.now();
		const duration = 500; // ms

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = elapsed / duration;

			if (progress >= 1) {
				this.scene.remove(particles);
				return;
			}

			// Scale up and fade out
			particles.scale.set(1 + progress * 2, 1 + progress * 2, 1 + progress * 2);
			particleMaterial.opacity = 1 - progress;

			requestAnimationFrame(animate);
		};

		animate();
	}

	public cleanup(): void {
		this.scene.remove(this.mesh);
	}
}
