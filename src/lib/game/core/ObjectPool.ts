import { Debug } from '../utils/Debug';

/**
 * Interface representing statistics for an object pool
 */
export interface PoolStats {
	type: string;
	size: number;
	active: number;
	available: number;
	maxSize: number;
}

/**
 * Generic object pool implementation for efficient object reuse
 */
export class ObjectPool<T> {
	private type: string;
	private createFn: () => T;
	private resetFn?: (obj: T) => void;
	private maxSize: number;

	private activeObjects: Set<T> = new Set();
	private availableObjects: T[] = [];

	/**
	 * Create a new object pool
	 *
	 * @param type Identifier for this pool type
	 * @param createFn Function to create new instances
	 * @param resetFn Optional function to reset objects before reuse
	 * @param initialSize Initial number of objects to create
	 * @param maxSize Maximum number of objects (0 for unlimited)
	 */
	constructor(
		type: string,
		createFn: () => T,
		resetFn?: (obj: T) => void,
		initialSize: number = 0,
		maxSize: number = 0
	) {
		this.type = type;
		this.createFn = createFn;
		this.resetFn = resetFn;
		this.maxSize = maxSize;

		// Pre-create objects
		for (let i = 0; i < initialSize; i++) {
			this.availableObjects.push(this.createNew());
		}
	}

	/**
	 * Create a new object
	 */
	private createNew(): T {
		return this.createFn();
	}

	/**
	 * Get an object from the pool, creating a new one if necessary
	 */
	get(): T {
		// Try to get from available pool first
		let obj: T;

		if (this.availableObjects.length > 0) {
			obj = this.availableObjects.pop()!;
		} else {
			// Check if we've reached the max size
			if (this.maxSize > 0 && this.activeObjects.size >= this.maxSize) {
				const debug = Debug.getInstance();
				debug.warn(`ObjectPool(${this.type}): Maximum size reached (${this.maxSize})`);
			}

			// Create new object
			obj = this.createNew();
		}

		// Reset if a reset function is provided
		if (this.resetFn) {
			this.resetFn(obj);
		}

		// Track as active
		this.activeObjects.add(obj);

		return obj;
	}

	/**
	 * Release an object back to the pool
	 */
	release(obj: T): void {
		// If not an active object, ignore
		if (!this.activeObjects.has(obj)) {
			return;
		}

		// Remove from active set
		this.activeObjects.delete(obj);

		// Add to available pool
		this.availableObjects.push(obj);
	}

	/**
	 * Get statistics about this pool
	 */
	getStats(): PoolStats {
		return {
			type: this.type,
			size: this.activeObjects.size + this.availableObjects.length,
			active: this.activeObjects.size,
			available: this.availableObjects.length,
			maxSize: this.maxSize
		};
	}

	/**
	 * Clear this pool, discarding all objects
	 */
	clear(): void {
		this.activeObjects.clear();
		this.availableObjects.length = 0;
	}
}
