import * as THREE from 'three';
import {
	MeleeEnemy,
	RangedEnemy,
	Enemy,
	BossEnemy,
	SplittingMeleeEnemy,
	AoeRangedEnemy
} from './Enemy';
import { PlayerCharacter } from './PlayerCharacter';

export class EnemyManager {
	private scene: THREE.Scene;
	private player: PlayerCharacter;
	public enemies: Enemy[] = [];
	private spawnCooldown: number = 2; // seconds between spawns
	private spawnTimer: number = 0;
	private maxEnemies: number = 50;
	private waveNumber: number = 1;
	private waveTimer: number = 0;
	private waveDuration: number = 30; // 30 seconds per wave
	private boundarySize: number;
	private bossSpawned: boolean = false;
	private bossDefeated: boolean = false;
	private gameWon: boolean = false;
	private isWaveTransitioning: boolean = false;

	// Static reference to the instance for singleton pattern
	private static instance: EnemyManager;

	constructor(scene: THREE.Scene, player: PlayerCharacter, boundarySize: number) {
		this.scene = scene;
		this.player = player;
		this.boundarySize = boundarySize;
		EnemyManager.instance = this; // Store instance for singleton access
	}

	// Static method to access the instance
	public static getInstance(): EnemyManager {
		return EnemyManager.instance;
	}

	// Method to get all enemies for collision detection
	public getEnemies(): Enemy[] {
		return this.enemies;
	}

	public update(delta: number): void {
		// Don't spawn new enemies if the boss is defeated or if we're at the boss wave and the boss is spawned
		if (this.gameWon || (this.waveNumber === 10 && this.bossSpawned && !this.bossDefeated)) {
			// Only update existing enemies
			this.updateEnemies(delta);
			return;
		}

		// Update wave timer
		if (!this.isWaveTransitioning && this.waveNumber < 10) {
			this.waveTimer += delta;

			// Check if wave is complete
			if (this.waveTimer >= this.waveDuration) {
				this.isWaveTransitioning = true;
				this.waveTimer = 0;
				this.advanceToNextWave();
				return;
			}
		}

		// Update spawn timer
		this.spawnTimer -= delta;

		// Spawn new enemies if timer is up and we haven't reached max
		if (this.spawnTimer <= 0 && this.enemies.length < this.maxEnemies) {
			this.spawnEnemy();

			// Reset timer with slight randomness - faster spawning in later waves
			const spawnRateMultiplier = Math.max(0.5, 1 - this.waveNumber * 0.05);
			this.spawnTimer = this.spawnCooldown * spawnRateMultiplier * (0.8 + Math.random() * 0.4);
		}

		this.updateEnemies(delta);
	}

	private updateEnemies(delta: number): void {
		// Update all enemies
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const enemy = this.enemies[i];

			if (enemy.isDead) {
				// Check if the boss was defeated
				if (enemy.getIsBoss()) {
					this.bossDefeated = true;
					this.gameWon = true;
					this.onGameWon();
				}

				this.enemies.splice(i, 1);
				continue;
			}

			enemy.update(delta);

			// Check collision with player
			const distanceToPlayer = enemy.getPosition().distanceTo(this.player.getPosition());
			if (distanceToPlayer < 1) {
				// Increased collision damage based on wave number and enemy type
				let collisionDamage = 2; // Base damage increased from 1

				// Scale damage with wave
				collisionDamage += Math.floor((this.waveNumber - 1) * 0.5);

				// Boss deals more damage on collision
				if (enemy.getIsBoss()) {
					collisionDamage *= 2;
				}

				const isDead = this.player.takeDamage(collisionDamage);
				if (isDead) {
					// Game over handling would go here
				}
			}
		}
	}

	private spawnEnemy(): void {
		// If we're at wave 10, don't spawn regular enemies if the boss is alive
		if (this.waveNumber === 10) {
			if (!this.bossSpawned) {
				this.spawnBoss();
				return;
			} else if (!this.bossDefeated) {
				// Don't spawn regular enemies while boss is alive
				return;
			}
		}

		// Determine spawn position
		const position = this.getRandomSpawnPosition();

		// Determine enemy type based on wave number
		let enemy: Enemy;

		// Implement the wave-based enemy spawn logic
		if (this.waveNumber <= 2) {
			// Waves 1-2: only melee enemies
			enemy = new MeleeEnemy(this.scene, position, this.player, this.waveNumber);
		} else if (this.waveNumber <= 4) {
			// Waves 3-4: melee and ranged enemies
			if (Math.random() < 0.5) {
				enemy = new RangedEnemy(this.scene, position, this.player, this.waveNumber);
			} else {
				enemy = new MeleeEnemy(this.scene, position, this.player, this.waveNumber);
			}
		} else if (this.waveNumber <= 6) {
			// Waves 5-6: melee, ranged, and splitting melee enemies
			const rand = Math.random();
			if (rand < 0.33) {
				enemy = new RangedEnemy(this.scene, position, this.player, this.waveNumber);
			} else if (rand < 0.66) {
				enemy = new MeleeEnemy(this.scene, position, this.player, this.waveNumber);
			} else {
				enemy = new SplittingMeleeEnemy(this.scene, position, this.player, this.waveNumber);
			}
		} else if (this.waveNumber <= 9) {
			// Waves 7-9: melee, ranged, splitting melee, and AOE ranged enemies
			const rand = Math.random();
			if (rand < 0.25) {
				enemy = new RangedEnemy(this.scene, position, this.player, this.waveNumber);
			} else if (rand < 0.5) {
				enemy = new MeleeEnemy(this.scene, position, this.player, this.waveNumber);
			} else if (rand < 0.75) {
				enemy = new SplittingMeleeEnemy(this.scene, position, this.player, this.waveNumber);
			} else {
				enemy = new AoeRangedEnemy(this.scene, position, this.player, this.waveNumber);
			}
		} else {
			// Wave 10: If boss is defeated, spawn all enemy types
			const rand = Math.random();
			if (rand < 0.25) {
				enemy = new RangedEnemy(this.scene, position, this.player, this.waveNumber);
			} else if (rand < 0.5) {
				enemy = new MeleeEnemy(this.scene, position, this.player, this.waveNumber);
			} else if (rand < 0.75) {
				enemy = new SplittingMeleeEnemy(this.scene, position, this.player, this.waveNumber);
			} else {
				enemy = new AoeRangedEnemy(this.scene, position, this.player, this.waveNumber);
			}
		}

		this.enemies.push(enemy);
	}

	private spawnBoss(): void {
		// Spawn the boss at the center of the level
		const bossPosition = new THREE.Vector3(0, 0, -15); // Start a bit away from the player
		const boss = new BossEnemy(this.scene, bossPosition, this.player, this.waveNumber);
		this.enemies.push(boss);
		this.bossSpawned = true;

		// Notify that boss has spawned
		this.onBossSpawned();
	}

	public advanceToNextWave(): void {
		this.waveNumber++;
		this.waveTimer = 0;
		this.isWaveTransitioning = false;

		// Cap at wave 10
		if (this.waveNumber > 10) {
			this.waveNumber = 10;
		}

		// Make spawning faster in later waves
		this.spawnCooldown = Math.max(0.5, this.spawnCooldown * 0.9);
		this.maxEnemies += 5;

		// If we've reached wave 10, spawn the boss
		if (this.waveNumber === 10) {
			// Clear all enemies before spawning boss
			this.clearAllEnemies();
			this.spawnBoss();
			return;
		}

		// Notify UI of wave change
		this.notifyWaveChange();

		// Spawn a group of enemies for the new wave
		const spawnCount = Math.min(5 + this.waveNumber, 10);

		// Spawn enemies based on wave number
		for (let i = 0; i < spawnCount; i++) {
			const position = this.getRandomSpawnPosition();

			if (this.waveNumber < 6) {
				// Only melee enemies in early waves
				this.enemies.push(new MeleeEnemy(this.scene, position, this.player, this.waveNumber));
			} else {
				// Include ranged enemies from wave 6
				const rangedProbability = 0.2 + (this.waveNumber - 6) * 0.05; // Cap at 40% in later waves

				if (Math.random() < rangedProbability) {
					this.enemies.push(new RangedEnemy(this.scene, position, this.player, this.waveNumber));
				} else {
					this.enemies.push(new MeleeEnemy(this.scene, position, this.player, this.waveNumber));
				}
			}
		}
	}

	public spawnInitialEnemies(): void {
		// Reset wave timer
		this.waveTimer = 0;

		// Spawn a group of enemies for the first wave
		const spawnCount = 5; // Start with 5 enemies for the first wave

		// Spawn only melee enemies for the first wave
		for (let i = 0; i < spawnCount; i++) {
			const position = this.getRandomSpawnPosition();
			this.enemies.push(new MeleeEnemy(this.scene, position, this.player, this.waveNumber));
		}

		// Notify UI of the initial wave
		this.notifyWaveChange();
	}

	private notifyWaveChange(): void {
		// Create wave transition text
		const waveText = document.createElement('div');
		waveText.textContent = `WAVE ${this.waveNumber}`;
		waveText.style.position = 'absolute';
		waveText.style.top = '50%';
		waveText.style.left = '50%';
		waveText.style.transform = 'translate(-50%, -50%)';
		waveText.style.color = '#ffffff';
		waveText.style.fontSize = '2.5rem';
		waveText.style.fontWeight = 'bold';
		waveText.style.fontFamily = 'Arial, sans-serif';
		waveText.style.textShadow = '0 0 10px #3498db';
		waveText.style.pointerEvents = 'none';
		waveText.style.zIndex = '1000';
		waveText.style.opacity = '0';
		waveText.style.transition = 'opacity 0.5s ease-in-out';

		document.body.appendChild(waveText);

		// Fade in
		setTimeout(() => {
			waveText.style.opacity = '1';
		}, 10);

		// Fade out after 2 seconds
		setTimeout(() => {
			waveText.style.opacity = '0';
			setTimeout(() => document.body.removeChild(waveText), 500);
		}, 2000);
	}

	private getRandomSpawnPosition(): THREE.Vector3 {
		const spawnDistance = this.boundarySize + 5;
		const angle = Math.random() * Math.PI * 2;

		const position = new THREE.Vector3(
			Math.sin(angle) * spawnDistance,
			0,
			Math.cos(angle) * spawnDistance
		);

		// Add randomness
		position.x += Math.random() * 4 - 2;
		position.z += Math.random() * 4 - 2;

		// Clamp to boundary
		const maxBoundary = this.boundarySize * 1.5;
		position.x = Math.max(-maxBoundary, Math.min(maxBoundary, position.x));
		position.z = Math.max(-maxBoundary, Math.min(maxBoundary, position.z));

		return position;
	}

	public checkWaveComplete(): boolean {
		// For time-based waves, this method is now used to check if boss is defeated
		if (this.waveNumber === 10) {
			return this.bossDefeated;
		}

		// Always return false for other waves since we're using time-based progression
		return false;
	}

	public getWaveProgress(): number {
		// Return progress as a percentage
		return (this.waveTimer / this.waveDuration) * 100;
	}

	public getWaveTimeRemaining(): number {
		return Math.max(0, this.waveDuration - this.waveTimer);
	}

	private clearAllEnemies(): void {
		// Remove all current enemies when transitioning to boss wave
		for (const enemy of this.enemies) {
			enemy.cleanup();
		}
		this.enemies = [];
	}

	private onBossSpawned(): void {
		// Alert the player that the boss has spawned
		const bossText = document.createElement('div');
		bossText.textContent = 'BOSS FIGHT';
		bossText.style.position = 'absolute';
		bossText.style.top = '50%';
		bossText.style.left = '50%';
		bossText.style.transform = 'translate(-50%, -50%)';
		bossText.style.color = '#ff0000';
		bossText.style.fontSize = '3rem';
		bossText.style.fontWeight = 'bold';
		bossText.style.fontFamily = 'Arial, sans-serif';
		bossText.style.textShadow = '0 0 10px #ff0000';
		bossText.style.pointerEvents = 'none';
		bossText.style.zIndex = '1000';
		bossText.style.opacity = '0';
		bossText.style.transition = 'opacity 0.5s ease-in-out';

		document.body.appendChild(bossText);

		// Fade in
		setTimeout(() => {
			bossText.style.opacity = '1';
		}, 10);

		// Fade out after 3 seconds
		setTimeout(() => {
			bossText.style.opacity = '0';
			setTimeout(() => document.body.removeChild(bossText), 500);
		}, 3000);
	}

	private onGameWon(): void {
		// Game won screen
		const victoryScreen = document.createElement('div');
		victoryScreen.style.position = 'absolute';
		victoryScreen.style.top = '0';
		victoryScreen.style.left = '0';
		victoryScreen.style.width = '100%';
		victoryScreen.style.height = '100%';
		victoryScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
		victoryScreen.style.display = 'flex';
		victoryScreen.style.flexDirection = 'column';
		victoryScreen.style.justifyContent = 'center';
		victoryScreen.style.alignItems = 'center';
		victoryScreen.style.zIndex = '1000';
		victoryScreen.style.opacity = '0';
		victoryScreen.style.transition = 'opacity 1s ease-in-out';
		victoryScreen.style.pointerEvents = 'auto';

		const victoryTitle = document.createElement('h1');
		victoryTitle.textContent = 'VICTORY!';
		victoryTitle.style.color = '#ffcc00';
		victoryTitle.style.fontSize = '4rem';
		victoryTitle.style.marginBottom = '2rem';
		victoryTitle.style.textShadow = '0 0 20px #ffcc00';
		victoryScreen.appendChild(victoryTitle);

		const victoryText = document.createElement('p');
		victoryText.textContent = 'You have defeated the boss and saved the cube realm!';
		victoryText.style.color = '#ffffff';
		victoryText.style.fontSize = '1.5rem';
		victoryText.style.marginBottom = '3rem';
		victoryScreen.appendChild(victoryText);

		const restartButton = document.createElement('button');
		restartButton.textContent = 'Play Again';
		restartButton.style.padding = '1rem 2rem';
		restartButton.style.fontSize = '1.5rem';
		restartButton.style.backgroundColor = '#3498db';
		restartButton.style.color = '#ffffff';
		restartButton.style.border = 'none';
		restartButton.style.borderRadius = '5px';
		restartButton.style.cursor = 'pointer';
		restartButton.style.transition = 'all 0.3s ease';

		restartButton.addEventListener('mouseenter', () => {
			restartButton.style.backgroundColor = '#2980b9';
			restartButton.style.transform = 'scale(1.05)';
		});

		restartButton.addEventListener('mouseleave', () => {
			restartButton.style.backgroundColor = '#3498db';
			restartButton.style.transform = 'scale(1)';
		});

		restartButton.addEventListener('click', () => {
			window.location.reload();
		});

		victoryScreen.appendChild(restartButton);
		document.body.appendChild(victoryScreen);

		// Fade in the victory screen
		setTimeout(() => {
			victoryScreen.style.opacity = '1';
		}, 10);
	}

	public isGameWon(): boolean {
		return this.gameWon;
	}

	public getWaveNumber(): number {
		return this.waveNumber;
	}

	public addEnemy(enemy: Enemy): void {
		this.enemies.push(enemy);
	}

	public cleanup(): void {
		for (const enemy of this.enemies) {
			enemy.cleanup();
		}
		this.enemies = [];
	}
}
