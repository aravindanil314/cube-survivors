import type { IGameObject } from './GameObject';
import { ObjectPool } from './ObjectPool';
import * as THREE from 'three';

/**
 * Factory responsible for creating, recycling, and managing game objects
 */
export class GameObjectFactory {
	private pools: Map<string, ObjectPool<IGameObject>> = new Map();
	private objects: Map<string, IGameObject> = new Map();
	private scene: THREE.Scene;

	constructor(scene: THREE.Scene) {
		this.scene = scene;
	}

	/**
	 * Register a new object type with this factory
	 *
	 * @param type Unique type name for this object class
	 * @param createFn Function that creates a new instance
	 * @param resetFn Optional custom reset function
	 * @param initialSize Number of objects to pre-create
	 * @param maxSize Maximum number of objects (0 for unlimited)
	 */
	registerType<T extends IGameObject>(
		type: string,
		createFn: () => T,
		resetFn?: (obj: T) => void,
		initialSize: number = 0,
		maxSize: number = 0
	): void {
		if (this.pools.has(type)) {
			console.warn(`GameObjectFactory: Type "${type}" already registered`);
			return;
		}

		const pool = new ObjectPool<T>(type, createFn, resetFn, initialSize, maxSize);
		this.pools.set(type, pool as unknown as ObjectPool<IGameObject>);
	}

	/**
	 * Create a new game object of the specified type
	 *
	 * @param type The type of object to create
	 * @returns A new or recycled game object
	 */
	create<T extends IGameObject>(type: string): T {
		const pool = this.pools.get(type);
		if (!pool) {
			throw new Error(`GameObjectFactory: Unknown type "${type}"`);
		}

		const obj = pool.get() as T;

		// Add to scene if it has a THREE.Object3D
		const object3D = obj.getObject3D();
		if (object3D) {
			this.scene.add(object3D);
		}

		// Store in the active objects map
		this.objects.set(obj.id, obj);

		return obj;
	}

	/**
	 * Remove an object and return it to its pool
	 *
	 * @param obj The object to release
	 */
	release(obj: IGameObject): void {
		if (!obj) return;

		// Remove from scene
		const object3D = obj.getObject3D();
		if (object3D) {
			this.scene.remove(object3D);
		}

		// Remove from active objects
		this.objects.delete(obj.id);

		// Find the right pool for this object type
		const type = obj.id.split('_')[0];
		const pool = this.pools.get(type);

		if (pool) {
			pool.release(obj);
		} else {
			console.warn(`GameObjectFactory: No pool found for object ${obj.id}`);
			obj.dispose();
		}
	}

	/**
	 * Update all active objects
	 *
	 * @param deltaTime Time elapsed since last update
	 */
	update(deltaTime: number): void {
		// Use for-of instead of forEach for better performance
		for (const obj of this.objects.values()) {
			if (obj.active) {
				obj.update(deltaTime);
			}
		}
	}

	/**
	 * Get all active objects
	 */
	getAllObjects(): IGameObject[] {
		return Array.from(this.objects.values());
	}

	/**
	 * Get an object by its ID
	 */
	getObjectById(id: string): IGameObject | undefined {
		return this.objects.get(id);
	}

	/**
	 * Get stats about all object pools
	 */
	getStats(): {
		totalPools: number;
		totalActiveObjects: number;
		pools: { [key: string]: unknown };
	} {
		const stats = {
			totalPools: this.pools.size,
			totalActiveObjects: this.objects.size,
			pools: {} as { [key: string]: unknown }
		};

		this.pools.forEach((pool, type) => {
			stats.pools[type] = pool.getStats();
		});

		return stats;
	}

	/**
	 * Dispose all objects and clear all pools
	 */
	dispose(): void {
		// Release all active objects first
		for (const obj of this.objects.values()) {
			this.release(obj);
		}

		// Clear all pools
		this.pools.forEach((pool) => {
			pool.clear();
		});

		this.pools.clear();
		this.objects.clear();
	}
}
