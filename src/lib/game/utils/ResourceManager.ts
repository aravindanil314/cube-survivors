import * as THREE from 'three';
import { Debug } from './Debug';

/**
 * ResourceManager - Singleton class to manage and cache all game resources
 * Handles proper reuse and disposal of THREE.js resources
 */
export class ResourceManager {
	private static instance: ResourceManager;
	private debug = Debug.getInstance();

	// Resource caches
	private textures: Map<string, THREE.Texture> = new Map();
	private geometries: Map<string, THREE.BufferGeometry> = new Map();
	private materials: Map<string, THREE.Material> = new Map();
	private meshes: Map<string, THREE.Mesh> = new Map();

	// Reference counting for shared resources
	private referenceCount: Map<string, number> = new Map();

	/**
	 * Private constructor to enforce singleton pattern
	 */
	private constructor() {}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(): ResourceManager {
		if (!ResourceManager.instance) {
			ResourceManager.instance = new ResourceManager();
		}
		return ResourceManager.instance;
	}

	/**
	 * Get or create a texture
	 * @param id Unique identifier for the texture
	 * @param createFn Function to create the texture if it doesn't exist
	 */
	public getTexture(id: string, createFn: () => THREE.Texture): THREE.Texture {
		if (!this.textures.has(id)) {
			const texture = createFn();
			this.textures.set(id, texture);
			this.referenceCount.set(`texture:${id}`, 0);
		}

		this.incrementReferenceCount(`texture:${id}`);
		return this.textures.get(id)!;
	}

	/**
	 * Get or create a geometry
	 * @param id Unique identifier for the geometry
	 * @param createFn Function to create the geometry if it doesn't exist
	 */
	public getGeometry(id: string, createFn: () => THREE.BufferGeometry): THREE.BufferGeometry {
		if (!this.geometries.has(id)) {
			const geometry = createFn();
			this.geometries.set(id, geometry);
			this.referenceCount.set(`geometry:${id}`, 0);
		}

		this.incrementReferenceCount(`geometry:${id}`);
		return this.geometries.get(id)!;
	}

	/**
	 * Get or create a material
	 * @param id Unique identifier for the material
	 * @param createFn Function to create the material if it doesn't exist
	 */
	public getMaterial(id: string, createFn: () => THREE.Material): THREE.Material {
		if (!this.materials.has(id)) {
			const material = createFn();
			this.materials.set(id, material);
			this.referenceCount.set(`material:${id}`, 0);
		}

		this.incrementReferenceCount(`material:${id}`);
		return this.materials.get(id)!;
	}

	/**
	 * Get or create a mesh
	 * @param id Unique identifier for the mesh
	 * @param createFn Function to create the mesh if it doesn't exist
	 */
	public getMesh(id: string, createFn: () => THREE.Mesh): THREE.Mesh {
		if (!this.meshes.has(id)) {
			const mesh = createFn();
			this.meshes.set(id, mesh);
			this.referenceCount.set(`mesh:${id}`, 0);
		}

		this.incrementReferenceCount(`mesh:${id}`);
		return this.meshes.get(id)!;
	}

	/**
	 * Create standard geometries used throughout the game
	 */
	public createStandardGeometries(): void {
		// Player geometry
		this.getGeometry('player', () => new THREE.BoxGeometry(1, 1, 1));

		// Enemy geometries
		this.getGeometry('enemy:basic', () => new THREE.BoxGeometry(0.8, 0.8, 0.8));
		this.getGeometry('enemy:fast', () => new THREE.ConeGeometry(0.5, 1, 6));
		this.getGeometry('enemy:tank', () => new THREE.BoxGeometry(1.2, 1.2, 1.2));
		this.getGeometry('enemy:boss', () => new THREE.OctahedronGeometry(1.5, 1));

		// Projectile geometry
		this.getGeometry('projectile:basic', () => new THREE.SphereGeometry(0.2, 8, 8));
		this.getGeometry('projectile:large', () => new THREE.SphereGeometry(0.4, 10, 10));

		// Collectible geometries
		this.getGeometry('collectible:experience', () => new THREE.TetrahedronGeometry(0.3, 0));
		this.getGeometry('collectible:health', () => new THREE.BoxGeometry(0.5, 0.5, 0.5));
		this.getGeometry('collectible:powerup', () => new THREE.OctahedronGeometry(0.5, 0));
	}

	/**
	 * Create standard materials used throughout the game
	 */
	public createStandardMaterials(): void {
		// Player material
		this.getMaterial(
			'player',
			() =>
				new THREE.MeshLambertMaterial({
					color: 0x00bfff,
					emissive: 0x0088cc
				})
		);

		// Enemy materials
		this.getMaterial(
			'enemy:basic',
			() =>
				new THREE.MeshLambertMaterial({
					color: 0xff5555,
					emissive: 0x881111
				})
		);
		this.getMaterial(
			'enemy:fast',
			() =>
				new THREE.MeshLambertMaterial({
					color: 0xffaa00,
					emissive: 0x884400
				})
		);
		this.getMaterial(
			'enemy:tank',
			() =>
				new THREE.MeshLambertMaterial({
					color: 0x8866ff,
					emissive: 0x442288
				})
		);
		this.getMaterial(
			'enemy:boss',
			() =>
				new THREE.MeshStandardMaterial({
					color: 0xff2266,
					emissive: 0x881133,
					metalness: 0.3,
					roughness: 0.7
				})
		);

		// Projectile materials
		this.getMaterial(
			'projectile:basic',
			() =>
				new THREE.MeshBasicMaterial({
					color: 0x66ffff,
					transparent: true,
					opacity: 0.8
				})
		);
		this.getMaterial(
			'projectile:critical',
			() =>
				new THREE.MeshBasicMaterial({
					color: 0xffff00,
					transparent: true,
					opacity: 0.9
				})
		);

		// Collectible materials
		this.getMaterial(
			'collectible:experience',
			() =>
				new THREE.MeshBasicMaterial({
					color: 0x22ff88,
					transparent: true,
					opacity: 0.8
				})
		);
		this.getMaterial(
			'collectible:health',
			() =>
				new THREE.MeshBasicMaterial({
					color: 0xff6688,
					transparent: true,
					opacity: 0.8
				})
		);
		this.getMaterial(
			'collectible:powerup',
			() =>
				new THREE.MeshBasicMaterial({
					color: 0xffaa22,
					transparent: true,
					opacity: 0.9
				})
		);
	}

	/**
	 * Release a resource when no longer needed
	 * @param type Resource type (texture, geometry, material, mesh)
	 * @param id Resource identifier
	 */
	public releaseResource(type: 'texture' | 'geometry' | 'material' | 'mesh', id: string): void {
		const key = `${type}:${id}`;

		if (this.decrementReferenceCount(key)) {
			// If reference count reached zero, dispose the resource
			switch (type) {
				case 'texture':
					if (this.textures.has(id)) {
						this.textures.get(id)!.dispose();
						this.textures.delete(id);
					}
					break;

				case 'geometry':
					if (this.geometries.has(id)) {
						this.geometries.get(id)!.dispose();
						this.geometries.delete(id);
					}
					break;

				case 'material':
					if (this.materials.has(id)) {
						this.materials.get(id)!.dispose();
						this.materials.delete(id);
					}
					break;

				case 'mesh':
					if (this.meshes.has(id)) {
						const mesh = this.meshes.get(id)!;

						// Properly dispose associated materials and geometries
						if (mesh.geometry) {
							mesh.geometry.dispose();
						}

						if (mesh.material) {
							if (Array.isArray(mesh.material)) {
								mesh.material.forEach((material) => material.dispose());
							} else {
								mesh.material.dispose();
							}
						}

						this.meshes.delete(id);
					}
					break;
			}
		}
	}

	/**
	 * Create a clone of a mesh
	 * @param id The mesh ID to clone
	 */
	public cloneMesh(id: string): THREE.Mesh | null {
		if (!this.meshes.has(id)) {
			// Using debug system instead of console.warn
			const debug = Debug.getInstance();
			debug.warn(`Mesh with id ${id} not found for cloning`);
			return null;
		}

		const original = this.meshes.get(id)!;
		const clone = original.clone();

		// Reference counting for the shared resources
		if (original.geometry) {
			this.incrementReferenceCount(`geometry:${original.geometry.uuid}`);
		}

		if (original.material) {
			if (Array.isArray(original.material)) {
				original.material.forEach((mat) => {
					this.incrementReferenceCount(`material:${mat.uuid}`);
				});
			} else {
				this.incrementReferenceCount(`material:${original.material.uuid}`);
			}
		}

		return clone;
	}

	/**
	 * Increment reference count for a resource
	 * @param key Resource key
	 */
	private incrementReferenceCount(key: string): void {
		const count = this.referenceCount.get(key) || 0;
		this.referenceCount.set(key, count + 1);
	}

	/**
	 * Decrement reference count for a resource
	 * @param key Resource key
	 * @returns true if resource can be disposed (count reached zero)
	 */
	private decrementReferenceCount(key: string): boolean {
		const count = this.referenceCount.get(key) || 0;

		if (count <= 1) {
			this.referenceCount.delete(key);
			return true;
		} else {
			this.referenceCount.set(key, count - 1);
			return false;
		}
	}

	/**
	 * Dispose all resources
	 */
	public disposeAll(): void {
		// Dispose all textures
		this.textures.forEach((texture) => {
			texture.dispose();
		});
		this.textures.clear();

		// Dispose all geometries
		this.geometries.forEach((geometry) => {
			geometry.dispose();
		});
		this.geometries.clear();

		// Dispose all materials
		this.materials.forEach((material) => {
			material.dispose();
		});
		this.materials.clear();

		// Dispose all meshes
		this.meshes.forEach((mesh) => {
			if (mesh.geometry) {
				mesh.geometry.dispose();
			}

			if (mesh.material) {
				if (Array.isArray(mesh.material)) {
					mesh.material.forEach((material) => material.dispose());
				} else {
					mesh.material.dispose();
				}
			}
		});
		this.meshes.clear();

		// Clear reference counts
		this.referenceCount.clear();
	}
}
