import { Debug, LogLevel } from './utils/Debug';

/**
 * Game configuration constants
 * This file centralizes all game settings for easier tuning and modification
 */

// Debug settings
export const DEBUG_CONFIG = {
	enabled: true,
	logLevel: LogLevel.INFO,
	showStats: true,
	showGrid: false, // Show spatial grid for debugging
	showBoundaries: true
};

// Performance settings
export const PERFORMANCE_CONFIG = {
	// Resource limits
	maxEnemies: 100,
	maxProjectiles: 200,
	maxCollectibles: 200,
	maxParticles: 500,
	maxVisibleEnemies: 100, // Maximum number of enemies rendered at once

	// Performance settings
	cullDistance: 30, // Distance at which objects are removed/disabled
	spatialGridCellSize: 5, // Size of spatial grid cells
	dynamicLOD: true, // Enable level of detail adjustments
	shadowsEnabled: true,

	// Quality settings (0=low, 1=medium, 2=high)
	currentQualityLevel: 1, // Default to medium quality
	particleDensity: 0.6, // Multiplier for particle effects (0.3 to 1.0)

	// Performance monitoring
	targetFPS: 60,
	performanceCheckInterval: 1.0 // seconds
};

// Player settings
export const PLAYER_CONFIG = {
	moveSpeed: 5,
	health: 100,
	maxHealth: 100,
	invulnerabilityTime: 0.5, // seconds
	collisionRadius: 0.5,
	experienceToNextLevel: 10,
	baseXpRequirement: 10,
	levelScalingFactor: 1.2,
	xpExponent: 1.1
};

// Enemy settings
export const ENEMY_CONFIG = {
	spawnRate: 2.0, // seconds between spawns
	healthMultiplier: 1.0, // base multiplier for all enemies
	damageMultiplier: 1.0, // base multiplier for all enemies
	speedMultiplier: 1.0, // base multiplier for all enemies
	waveScaling: 0.2, // % increase per wave
	types: {
		melee: {
			health: 3,
			speed: 1.8,
			damage: 2,
			collisionRadius: 0.6,
			healthDropChance: 0.15
		},
		ranged: {
			health: 2,
			speed: 1.4,
			damage: 2,
			projectileSpeed: 5,
			collisionRadius: 0.55,
			healthDropChance: 0.2,
			preferredDistance: 8
		},
		boss: {
			health: 50,
			speed: 1.3,
			damage: 4,
			collisionRadius: 1.8,
			healthDropChance: 1.0,
			specialAttackCooldown: 5.0,
			bossMultiplier: 2.5 // Additional multiplier for bosses
		}
	},
	waveDuration: 30, // seconds
	waveCount: 10, // total waves
	initialSpawnCount: 5 // enemies at start
};

// Weapon settings
export const WEAPON_CONFIG = {
	baseStats: {
		damage: 1,
		cooldownTime: 0.5,
		projectileSpeed: 10,
		projectileCount: 1,
		spreadAngle: 0
	},
	criticalHit: {
		chance: 0.1,
		multiplier: 2.0
	},
	poison: {
		damage: 0.5,
		duration: 3.0
	},
	// Upgrade multipliers
	upgrades: {
		damagePerLevel: 0.5,
		cooldownReduction: 0.05,
		projectilePerLevels: 3 // Add projectile every X levels
	}
};

// Collectible settings
export const COLLECTIBLE_CONFIG = {
	attractionRadius: 5,
	magnetRadius: 10,
	experienceValue: 1,
	healthValue: 10,
	autoCollectDistance: 1.2
};

// Visual settings
export const VISUAL_CONFIG = {
	colors: {
		player: 0x4facfe,
		playerEmissive: 0x0066cc,
		enemyMelee: 0xff3333,
		enemyRanged: 0x9933ff,
		enemyBoss: 0xffcc00,
		projectile: 0xffff00,
		experienceOrb: 0x00ffff,
		healthOrb: 0xff0066,
		background: 0x050510
	},
	particles: {
		enable: true,
		density: 1.0 // Multiplier for particle counts
	},
	postProcessing: {
		enable: false, // Disable for performance
		bloom: {
			threshold: 0.8,
			strength: 1.5,
			radius: 0.4
		}
	}
};

// Sound settings
export const SOUND_CONFIG = {
	enabled: true,
	volume: 0.5,
	musicVolume: 0.3,
	sfxVolume: 0.7,
	spatialAudio: true
};

// World settings
export const WORLD_CONFIG = {
	boundarySize: 20,
	floorSize: 200,
	ambientLightIntensity: 2,
	directionalLightIntensity: 1.2
};

// Initialize the debug system
export function initDebug(container: HTMLElement): void {
	Debug.getInstance().init(container, DEBUG_CONFIG.enabled, DEBUG_CONFIG.logLevel);
}

// Helper function to dynamically adjust settings based on performance
export function adjustSettingsForPerformance(fps: number): void {
	const debug = Debug.getInstance();

	if (fps < 30) {
		// Low performance mode
		debug.warn('Low performance detected, reducing visual quality');
		PERFORMANCE_CONFIG.maxEnemies = 50;
		PERFORMANCE_CONFIG.maxParticles = 200;
		PERFORMANCE_CONFIG.shadowsEnabled = false;
		VISUAL_CONFIG.particles.density = 0.5;
	} else if (fps < 45) {
		// Medium performance mode
		debug.info('Medium performance detected, adjusting settings');
		PERFORMANCE_CONFIG.maxEnemies = 75;
		PERFORMANCE_CONFIG.maxParticles = 350;
		PERFORMANCE_CONFIG.shadowsEnabled = true;
		VISUAL_CONFIG.particles.density = 0.75;
	} else {
		// High performance mode
		debug.info('High performance detected, using optimal settings');
		PERFORMANCE_CONFIG.maxEnemies = 100;
		PERFORMANCE_CONFIG.maxParticles = 500;
		PERFORMANCE_CONFIG.shadowsEnabled = true;
		VISUAL_CONFIG.particles.density = 1.0;
	}
}
