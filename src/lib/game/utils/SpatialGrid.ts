import { Debug } from './Debug';
import type { Vector3 } from 'three';

/**
 * Interface for any object that can be stored in the spatial grid
 */
export interface SpatialObject {
	id: string | number; // Unique identifier
	position: Vector3; // Current position in 3D space
	radius?: number; // Optional collision radius
}

// Define the SpatialGridItem alias for backward compatibility
export type SpatialGridItem = SpatialObject;

/**
 * A spatial grid for efficient collision detection and spatial queries
 * Divides 3D space into cells and places objects into appropriate cells
 * Allows for efficient queries of nearby objects instead of checking all objects
 */
export class SpatialGrid<T extends SpatialObject> {
	private cells: Map<string, T[]> = new Map();
	private cellSize: number;
	private objects: Map<string | number, T> = new Map();
	private debug = Debug.getInstance();

	/**
	 * @param cellSize The size of each cell in the grid
	 */
	constructor(cellSize: number) {
		this.cellSize = cellSize;
	}

	/**
	 * Generate a cell key from a position
	 */
	private getCellKey(x: number, y: number, z: number): string {
		// Floor to get grid cell coordinates
		const cellX = Math.floor(x / this.cellSize);
		const cellY = Math.floor(y / this.cellSize);
		const cellZ = Math.floor(z / this.cellSize);
		return `${cellX},${cellY},${cellZ}`;
	}

	/**
	 * Get the cell coordinates that an object with given position and radius would occupy
	 */
	private getCellsForObject(object: T): string[] {
		const radius = object.radius || 0;
		const pos = object.position;

		// Calculate min and max coordinates
		const minX = pos.x - radius;
		const maxX = pos.x + radius;
		const minY = pos.y - radius;
		const maxY = pos.y + radius;
		const minZ = pos.z - radius;
		const maxZ = pos.z + radius;

		// Get min and max cell coordinates
		const minCellX = Math.floor(minX / this.cellSize);
		const maxCellX = Math.floor(maxX / this.cellSize);
		const minCellY = Math.floor(minY / this.cellSize);
		const maxCellY = Math.floor(maxY / this.cellSize);
		const minCellZ = Math.floor(minZ / this.cellSize);
		const maxCellZ = Math.floor(maxZ / this.cellSize);

		const cells: string[] = [];

		// Generate all cell keys that this object overlaps
		for (let x = minCellX; x <= maxCellX; x++) {
			for (let y = minCellY; y <= maxCellY; y++) {
				for (let z = minCellZ; z <= maxCellZ; z++) {
					cells.push(`${x},${y},${z}`);
				}
			}
		}

		return cells;
	}

	/**
	 * Insert an object into the grid
	 */
	public insert(object: T): void {
		const id = object.id;

		// Store the object
		this.objects.set(id, object);

		// Add to appropriate cells
		const cellKeys = this.getCellsForObject(object);
		for (const key of cellKeys) {
			if (!this.cells.has(key)) {
				this.cells.set(key, []);
			}
			this.cells.get(key)!.push(object);
		}
	}

	/**
	 * Update an object's position in the grid
	 */
	public update(object: T): void {
		// Remove the old entries
		this.remove(object.id);

		// Re-insert with new position
		this.insert(object);
	}

	/**
	 * Remove an object from the grid
	 */
	public remove(id: string | number): void {
		const object = this.objects.get(id);
		if (!object) return;

		// Remove from all cells
		const cellKeys = this.getCellsForObject(object);
		for (const key of cellKeys) {
			const cell = this.cells.get(key);
			if (cell) {
				// Filter the object out
				const filtered = cell.filter((obj) => obj.id !== id);
				if (filtered.length > 0) {
					this.cells.set(key, filtered);
				} else {
					// If cell is empty, remove it
					this.cells.delete(key);
				}
			}
		}

		// Remove from objects map
		this.objects.delete(id);
	}

	/**
	 * Get all objects near a position
	 * @param position The position to query
	 * @param radius The radius to search within
	 */
	public queryRadius(position: Vector3, radius: number): T[] {
		const nearbyObjects = new Set<T>();

		// Calculate min and max coordinates
		const minX = position.x - radius;
		const maxX = position.x + radius;
		const minY = position.y - radius;
		const maxY = position.y + radius;
		const minZ = position.z - radius;
		const maxZ = position.z + radius;

		// Get min and max cell coordinates
		const minCellX = Math.floor(minX / this.cellSize);
		const maxCellX = Math.floor(maxX / this.cellSize);
		const minCellY = Math.floor(minY / this.cellSize);
		const maxCellY = Math.floor(maxY / this.cellSize);
		const minCellZ = Math.floor(minZ / this.cellSize);
		const maxCellZ = Math.floor(maxZ / this.cellSize);

		// Check all potentially overlapping cells
		for (let x = minCellX; x <= maxCellX; x++) {
			for (let y = minCellY; y <= maxCellY; y++) {
				for (let z = minCellZ; z <= maxCellZ; z++) {
					const key = `${x},${y},${z}`;
					const cell = this.cells.get(key);

					if (cell) {
						// Add all objects from this cell
						cell.forEach((obj) => nearbyObjects.add(obj));
					}
				}
			}
		}

		// Further filter to ensure actual distance is within radius
		const result: T[] = [];
		const radiusSquared = radius * radius;

		nearbyObjects.forEach((obj) => {
			const dx = obj.position.x - position.x;
			const dy = obj.position.y - position.y;
			const dz = obj.position.z - position.z;
			const distanceSquared = dx * dx + dy * dy + dz * dz;

			if (distanceSquared <= radiusSquared) {
				result.push(obj);
			}
		});

		return result;
	}

	/**
	 * Get all objects in the given cell
	 */
	public getObjectsInCell(x: number, y: number, z: number): T[] {
		const key = this.getCellKey(x, y, z);
		return this.cells.get(key) || [];
	}

	/**
	 * Get all objects that could potentially collide with the given object
	 */
	public getPotentialCollisions(object: T): T[] {
		const nearbyObjects = new Set<T>();
		const cellKeys = this.getCellsForObject(object);

		// Collect objects from all cells this object overlaps
		for (const key of cellKeys) {
			const cell = this.cells.get(key);
			if (cell) {
				cell.forEach((obj) => {
					// Don't include the object itself
					if (obj.id !== object.id) {
						nearbyObjects.add(obj);
					}
				});
			}
		}

		return Array.from(nearbyObjects);
	}

	/**
	 * Clear all objects from the grid
	 */
	public clear(): void {
		this.cells.clear();
		this.objects.clear();
		this.debug.debug('Spatial grid cleared');
	}

	/**
	 * Get all objects in the grid
	 */
	public getAllObjects(): T[] {
		return Array.from(this.objects.values());
	}

	/**
	 * Get the count of objects in the grid
	 */
	public getObjectCount(): number {
		return this.objects.size;
	}

	/**
	 * Get the number of cells in the grid
	 */
	public get cellCount(): number {
		return this.cells.size;
	}
}
