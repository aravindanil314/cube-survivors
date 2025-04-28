import * as THREE from 'three';
import { Debug } from '../utils/Debug';

/**
 * Interface for entities that can have status effects applied
 */
export interface StatusEffectTarget {
	isDead: boolean;
	takeDamage: (amount: number) => void;
	attachEffect: (effect: THREE.Object3D, id: string) => void;
	removeEffect: (id: string) => void;
}

/**
 * Status effect types supported by the system
 */
export type StatusEffectType = 'poison' | 'burn' | 'slow' | 'stun' | 'buff';

/**
 * Interface defining a status effect
 */
export interface StatusEffect {
	id: string;
	type: StatusEffectType;
	duration: number;
	tickInterval?: number;
	onTick?: (target: StatusEffectTarget) => void;
	onStart?: (target: StatusEffectTarget) => void;
	onEnd?: (target: StatusEffectTarget) => void;
}

/**
 * StatusEffectManager handles tracking and updating status effects on entities
 */
export class StatusEffectManager {
	private effects: Map<string, { effect: StatusEffect; elapsed: number; lastTick: number }>;
	private target: StatusEffectTarget;
	private debug = Debug.getInstance();

	constructor(target: StatusEffectTarget) {
		this.target = target;
		this.effects = new Map();
	}

	/**
	 * Add a status effect to the target
	 */
	public addEffect(effect: StatusEffect): void {
		// Check if effect already exists
		if (this.effects.has(effect.id)) {
			// Replace existing effect
			this.removeEffect(effect.id);
		}

		// Add new effect
		this.effects.set(effect.id, {
			effect,
			elapsed: 0,
			lastTick: 0
		});

		// Call onStart handler if provided
		if (effect.onStart) {
			effect.onStart(this.target);
		}

		this.debug.debug(`Added ${effect.type} effect (${effect.id}) to target`);
	}

	/**
	 * Remove a status effect by ID
	 */
	public removeEffect(id: string): void {
		if (this.effects.has(id)) {
			const { effect } = this.effects.get(id)!;

			// Call onEnd handler if provided
			if (effect.onEnd) {
				effect.onEnd(this.target);
			}

			this.effects.delete(id);
			this.debug.debug(`Removed ${effect.type} effect (${id}) from target`);
		}
	}

	/**
	 * Check if target has an effect of the given type
	 */
	public hasEffectOfType(type: StatusEffectType): boolean {
		for (const { effect } of this.effects.values()) {
			if (effect.type === type) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Update all status effects
	 */
	public update(delta: number): void {
		if (this.target.isDead) {
			// Clear all effects if target is dead
			this.clearAllEffects();
			return;
		}

		// Update each effect
		for (const [id, data] of this.effects.entries()) {
			const { effect, elapsed, lastTick } = data;

			// Update elapsed time
			const newElapsed = elapsed + delta;
			let newLastTick = lastTick;

			// Process tick if needed
			if (effect.tickInterval && effect.onTick) {
				const tickElapsed = newElapsed - lastTick;
				if (tickElapsed >= effect.tickInterval) {
					// Apply tick effect
					effect.onTick(this.target);
					newLastTick = newElapsed;
				}
			}

			// Check if effect has expired
			if (newElapsed >= effect.duration) {
				this.removeEffect(id);
			} else {
				// Update time tracking
				this.effects.set(id, {
					effect,
					elapsed: newElapsed,
					lastTick: newLastTick
				});
			}
		}
	}

	/**
	 * Remove all status effects
	 */
	public clearAllEffects(): void {
		// Call onEnd for all effects
		for (const { effect } of this.effects.values()) {
			if (effect.onEnd) {
				effect.onEnd(this.target);
			}
		}

		this.effects.clear();
		this.debug.debug('Cleared all status effects from target');
	}

	/**
	 * Get the number of active effects
	 */
	public getEffectCount(): number {
		return this.effects.size;
	}

	/**
	 * Get a list of active effect types
	 */
	public getActiveEffectTypes(): StatusEffectType[] {
		const types: StatusEffectType[] = [];
		for (const { effect } of this.effects.values()) {
			if (!types.includes(effect.type)) {
				types.push(effect.type);
			}
		}
		return types;
	}
}
