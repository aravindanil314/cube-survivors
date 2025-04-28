import { Debug } from './Debug';

/**
 * Generic object pool for efficient reuse of objects
 */
export class ObjectPool<T> {
	private available: T[] = [];
	private active: Set<T> = new Set();
	private createFn: () => T;
	private resetFn: (obj: T) => void;
	private maxSize: number;
	private name: string;
	private debug = Debug.getInstance();

	/**
	 * Create a new object pool
	 * @param createFn Function to create a new object
	 * @param resetFn Function to reset an object before reuse
	 * @param initialSize Initial pool size
	 * @param maxSize Maximum pool size
	 * @param name Name for tracking/debugging
	 */
	constructor(
		createFn: () => T,
		resetFn: (obj: T) => void,
		initialSize = 0,
		maxSize = 100,
		name: string = 'GenericObject'
	) {
		this.createFn = createFn;
		this.resetFn = resetFn;
		this.maxSize = maxSize;
		this.name = name;

		// Pre-populate the pool with initial objects
		for (let i = 0; i < initialSize; i++) {
			this.available.push(this.createFn());
		}

		this.debug.info(`Created ${name} pool with ${initialSize} initial objects, max ${maxSize}`);
	}

	/**
	 * Get an object from the pool or create a new one if needed
	 * @returns An object from the pool
	 */
	public get(): T {
		let obj: T;

		if (this.available.length > 0) {
			// Reuse an existing object
			obj = this.available.pop()!;
		} else if (this.getTotalSize() < this.maxSize) {
			// Create a new object if we haven't reached the maximum size
			obj = this.createFn();
		} else {
			// We've reached the maximum size and have no available objects
			console.warn('Object pool maximum size reached. Consider increasing the maximum size.');
			return null as unknown as T;
		}

		// Reset the object before returning it
		this.resetFn(obj);
		this.active.add(obj);

		this.debug.debug(`Reusing ${this.name} from pool, ${this.available.length} remaining`);
		this.debug.trackObject(this.name);
		return obj;
	}

	/**
	 * Return an object to the pool
	 * @param obj Object to return to the pool
	 */
	public release(obj: T): void {
		if (!obj) return;

		if (this.active.has(obj)) {
			this.active.delete(obj);
			this.available.push(obj);
		} else if (!this.available.includes(obj)) {
			// If the object wasn't active and isn't already in available,
			// it might be from another pool or manually created
			console.warn('Returning an object that was not retrieved from this pool');
			this.available.push(obj);
		}

		this.debug.debug(`Returned ${this.name} to pool, now ${this.available.length} available`);
		this.debug.untrackObject(this.name);
	}

	/**
	 * Get the number of available objects in the pool
	 */
	public getAvailableCount(): number {
		return this.available.length;
	}

	/**
	 * Get the number of active objects from the pool
	 */
	public getActiveCount(): number {
		return this.active.size;
	}

	/**
	 * Get the total size of the pool (active + available)
	 */
	public getTotalSize(): number {
		return this.active.size + this.available.length;
	}

	/**
	 * Clear the pool, releasing all objects
	 */
	public clear(): void {
		this.available = [];
		this.active.clear();

		this.debug.info(
			`Cleared ${this.name} pool, ${this.getTotalSize() - this.getAvailableCount()} objects still active`
		);
	}

	/**
	 * Create a new object pool with objects that implement a specific interface
	 * with create() and reset() methods
	 */
	static createFromInterface<T extends { reset(): void }>(
		ctor: new () => T,
		initialSize = 0,
		maxSize = 0
	): ObjectPool<T> {
		return new ObjectPool<T>(
			() => new ctor(),
			(obj) => obj.reset(),
			initialSize,
			maxSize
		);
	}

	/**
	 * Get the current size of the pool
	 */
	public get size(): number {
		return this.available.length;
	}
}
