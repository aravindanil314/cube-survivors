import * as THREE from 'three';
import { GameObject } from '../core/GameObject';

/**
 * Represents a projectile fired by the player or enemies
 */
export class Projectile extends GameObject {
	private speed: number = 10;
	private damage: number = 1;
	private lifespan: number = 2; // seconds
	private lifetime: number = 0;
	private direction: THREE.Vector3 = new THREE.Vector3(0, 0, 1);

	/**
	 * Create a new projectile
	 */
	constructor() {
		super('projectile');

		// Create the visual representation
		const geometry = new THREE.SphereGeometry(0.2, 8, 8);
		const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
		this.object3D = new THREE.Mesh(geometry, material);

		// Set initial position and make inactive by default
		this.object3D.visible = false;
		this.active = false;
	}

	/**
	 * Fire the projectile
	 *
	 * @param position Initial position
	 * @param direction Direction of travel
	 * @param speed Speed in units per second
	 * @param damage Damage value
	 */
	fire(position: THREE.Vector3, direction: THREE.Vector3, speed?: number, damage?: number): void {
		// Reset lifetime
		this.lifetime = 0;

		// Set position
		this.position.copy(position);
		if (this.object3D) {
			this.object3D.position.copy(position);
		}

		// Set direction and normalize
		this.direction.copy(direction).normalize();

		// Set optional parameters
		if (speed !== undefined) this.speed = speed;
		if (damage !== undefined) this.damage = damage;

		// Activate
		this.active = true;
		if (this.object3D) {
			this.object3D.visible = true;
		}
	}

	/**
	 * Update projectile position
	 *
	 * @param deltaTime Time since last update in seconds
	 */
	update(deltaTime: number): void {
		if (!this.active) return;

		// Update lifetime and deactivate if expired
		this.lifetime += deltaTime;
		if (this.lifetime >= this.lifespan) {
			this.active = false;
			if (this.object3D) {
				this.object3D.visible = false;
			}
			return;
		}

		// Move in the direction
		const distance = this.speed * deltaTime;
		this.position.addScaledVector(this.direction, distance);

		// Update visual representation
		if (this.object3D) {
			this.object3D.position.copy(this.position);
		}
	}

	/**
	 * Reset the projectile for reuse
	 */
	reset(): void {
		super.reset();

		this.lifetime = 0;
		this.speed = 10;
		this.damage = 1;
		this.direction.set(0, 0, 1);

		if (this.object3D) {
			this.object3D.visible = false;
		}

		this.active = false;
	}

	/**
	 * Get the damage value of this projectile
	 */
	getDamage(): number {
		return this.damage;
	}
}
