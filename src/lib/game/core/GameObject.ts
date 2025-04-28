import * as THREE from 'three';

/**
 * Interface for all game objects that can be created, recycled and managed
 */
export interface IGameObject {
	id: string;
	active: boolean;

	update(deltaTime: number): void;
	reset(): void;
	dispose(): void;
	getObject3D(): THREE.Object3D | null;
}

/**
 * Base class for all game objects
 */
export abstract class GameObject implements IGameObject {
	id: string;
	active: boolean = true;

	// Three.js object for visual representation
	protected object3D: THREE.Object3D | null = null;

	// Components and state
	protected position: THREE.Vector3 = new THREE.Vector3();
	protected velocity: THREE.Vector3 = new THREE.Vector3();

	constructor(type: string) {
		// Generate unique ID with type prefix and timestamp
		this.id = `${type}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
	}

	/**
	 * Get the current position
	 */
	getPosition(): THREE.Vector3 {
		return this.position.clone();
	}

	/**
	 * Set the position of the object
	 */
	setPosition(x: number, y: number, z: number): void {
		this.position.set(x, y, z);
		if (this.object3D) {
			this.object3D.position.copy(this.position);
		}
	}

	/**
	 * Get the current velocity
	 */
	getVelocity(): THREE.Vector3 {
		return this.velocity.clone();
	}

	/**
	 * Set the velocity of the object
	 */
	setVelocity(x: number, y: number, z: number): void {
		this.velocity.set(x, y, z);
	}

	/**
	 * Get the 3D object for rendering
	 */
	getObject3D(): THREE.Object3D | null {
		return this.object3D;
	}

	/**
	 * Set whether the object is active (updates and renders) or not
	 */
	setActive(active: boolean): void {
		this.active = active;
		if (this.object3D) {
			this.object3D.visible = active;
		}
	}

	/**
	 * Update the game object (position, state, etc.)
	 * @param deltaTime Time elapsed since last update in seconds
	 */
	abstract update(deltaTime: number): void;

	/**
	 * Reset the object for reuse
	 */
	reset(): void {
		this.active = true;
		this.position.set(0, 0, 0);
		this.velocity.set(0, 0, 0);

		if (this.object3D) {
			this.object3D.position.copy(this.position);
			this.object3D.visible = true;
			this.object3D.rotation.set(0, 0, 0);
			this.object3D.scale.set(1, 1, 1);
		}
	}

	/**
	 * Dispose of all resources used by this object
	 */
	dispose(): void {
		this.active = false;

		if (this.object3D) {
			// Traverse the object3D to dispose all geometries and materials
			this.object3D.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					if (child.geometry) {
						child.geometry.dispose();
					}

					if (child.material) {
						if (Array.isArray(child.material)) {
							child.material.forEach((material) => material.dispose());
						} else {
							child.material.dispose();
						}
					}
				}
			});

			// Remove from parent
			if (this.object3D.parent) {
				this.object3D.parent.remove(this.object3D);
			}
		}
	}
}
