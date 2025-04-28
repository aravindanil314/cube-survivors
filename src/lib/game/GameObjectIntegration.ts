import * as THREE from 'three';
import { Debug } from './utils/Debug';
import { GameObjectFactory } from './core/GameObjectFactory';
import type { IGameObject } from './core/GameObject';
import { Projectile } from './entities/Projectile';

/**
 * Example class showing how to integrate the object pooling system with the game
 */
export class GameObjectIntegration {
	private scene: THREE.Scene;
	private factory: GameObjectFactory;
	private debug = Debug.getInstance();

	constructor(scene: THREE.Scene) {
		this.scene = scene;
		this.factory = new GameObjectFactory(scene);

		// Register various game object types
		this.registerGameObjects();

		this.debug.info('GameObjectIntegration initialized');
	}

	/**
	 * Register all game object types with the factory
	 */
	private registerGameObjects(): void {
		// Register projectiles
		this.factory.registerType<Projectile>(
			'projectile',
			() => new Projectile(),
			undefined,
			50, // Pre-create 50 projectiles
			200 // Maximum pool size
		);

		// Register other game object types here
		// this.factory.registerType<Enemy>('enemy', ...);
		// this.factory.registerType<Collectible>('collectible', ...);
	}

	/**
	 * Update all managed game objects
	 * @param deltaTime Time elapsed since last update
	 */
	public update(deltaTime: number): void {
		// The factory handles updating all active game objects
		this.factory.update(deltaTime);
	}

	/**
	 * Create a projectile
	 * @param position Starting position
	 * @param direction Direction vector
	 * @param speed Speed
	 * @param damage Damage amount
	 * @returns The created projectile
	 */
	public createProjectile(
		position: THREE.Vector3,
		direction: THREE.Vector3,
		speed: number = 10,
		damage: number = 1
	): Projectile {
		const projectile = this.factory.create<Projectile>('projectile');
		projectile.fire(position, direction, speed, damage);
		return projectile;
	}

	/**
	 * Release a game object back to its pool
	 * @param gameObject The object to release
	 */
	public releaseObject(gameObject: IGameObject): void {
		this.factory.release(gameObject);
	}

	/**
	 * Get game object stats for debugging
	 */
	public getStats(): { totalActive: number; stats: ReturnType<GameObjectFactory['getStats']> } {
		const factoryStats = this.factory.getStats();
		return {
			totalActive: factoryStats.totalActiveObjects,
			stats: factoryStats
		};
	}

	/**
	 * Clean up resources when shutting down
	 */
	public dispose(): void {
		this.factory.dispose();
		this.debug.info('GameObjectIntegration resources disposed');
	}
}
