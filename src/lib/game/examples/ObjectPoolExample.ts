import * as THREE from 'three';
import { GameObjectFactory } from '../core/GameObjectFactory';
import { Projectile } from '../entities/Projectile';

/**
 * Example demonstrating how to use object pooling with game entities
 */
export class ObjectPoolExample {
	private scene: THREE.Scene;
	private camera: THREE.Camera;
	private factory: GameObjectFactory;
	private clock: THREE.Clock;
	private spawnerPosition: THREE.Vector3;
	private spawnInterval: number = 0.1; // seconds between spawns
	private timeSinceLastSpawn: number = 0;
	private maxProjectiles: number = 100;
	private projectileCount: number = 0;

	constructor(scene: THREE.Scene, camera: THREE.Camera) {
		this.scene = scene;
		this.camera = camera;
		this.factory = new GameObjectFactory(scene);
		this.clock = new THREE.Clock();
		this.spawnerPosition = new THREE.Vector3(0, 0, 0);

		// Register the projectile type with the factory
		this.factory.registerType<Projectile>(
			'projectile',
			() => new Projectile(),
			undefined,
			20, // Pre-create 20 projectiles
			200 // Max pool size
		);

		// Add a visual representation of the spawner
		const spawnerGeometry = new THREE.BoxGeometry(1, 1, 1);
		const spawnerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
		const spawnerMesh = new THREE.Mesh(spawnerGeometry, spawnerMaterial);
		spawnerMesh.position.copy(this.spawnerPosition);
		scene.add(spawnerMesh);

		console.log('Object Pool Example initialized');
	}

	/**
	 * Update the simulation
	 */
	update(): void {
		const deltaTime = this.clock.getDelta();

		// Spawn new projectiles
		this.timeSinceLastSpawn += deltaTime;
		if (
			this.timeSinceLastSpawn >= this.spawnInterval &&
			this.projectileCount < this.maxProjectiles
		) {
			this.spawnProjectile();
			this.timeSinceLastSpawn = 0;
		}

		// Update all game objects
		this.factory.update(deltaTime);

		// Log stats periodically
		if (Math.random() < 0.01) {
			// ~1% chance per frame to log stats
			console.log('Object Pool Stats:', JSON.stringify(this.factory.getStats(), null, 2));
		}
	}

	/**
	 * Spawn a new projectile with random direction
	 */
	private spawnProjectile(): void {
		// Create random direction
		const angle = Math.random() * Math.PI * 2;
		const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

		// Random speed
		const speed = 5 + Math.random() * 10;

		// Random color
		const color = new THREE.Color(Math.random(), Math.random(), Math.random());

		// Create projectile from factory
		const projectile = this.factory.create<Projectile>('projectile');

		// Configure and fire the projectile
		projectile.fire(
			this.spawnerPosition.clone(),
			direction,
			speed,
			1 // damage
		);

		// Set a random color for the projectile's material
		const mesh = projectile.getObject3D() as THREE.Mesh;
		if (mesh && mesh.material instanceof THREE.MeshBasicMaterial) {
			mesh.material.color = color;
		}

		this.projectileCount++;

		// After 5 seconds, release the projectile back to the pool
		setTimeout(() => {
			if (projectile.active) {
				this.factory.release(projectile);
				this.projectileCount--;
			}
		}, 5000);
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		this.factory.dispose();
	}
}
