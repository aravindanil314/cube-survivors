import { PlayerCharacter } from './PlayerCharacter';
import EventEmitter from 'eventemitter3';

interface UIElements {
	healthBar: HTMLElement;
	healthText: HTMLElement;
	levelText: HTMLElement;
	experienceBar: HTMLElement;
	scoreText: HTMLElement;
	gameOverPanel: HTMLElement;
	waveText: HTMLElement;
	waveProgressBar: HTMLElement;
	waveTimeText: HTMLElement;
	statsPanel: HTMLElement;
	pausePanel: HTMLElement;
	pauseButton: HTMLElement;
	pauseOverlay: HTMLElement;
}

// Define Powerup interface
interface Powerup {
	id: string;
	name: string;
	description: string;
	icon: string;
	color: string;
}

export class GameUI {
	private player: PlayerCharacter;
	private container: HTMLElement;
	private elements: UIElements;
	private score: number = 0;
	private waveNumber: number = 1;
	private topBar!: HTMLElement;
	private waveText!: HTMLElement;
	private scoreText!: HTMLElement;
	private pauseButton!: HTMLElement;
	private waveProgressContainer!: HTMLElement;
	private touchControls!: HTMLElement;
	private joystickContainer!: HTMLElement;
	private joystickHandle!: HTMLElement;
	private isTouchActive: boolean = false;
	private touchStartPos = { x: 0, y: 0 };
	private joystickPos = { x: 0, y: 0 };
	private movementVector = { x: 0, z: 0 };
	private maxJoystickDistance: number = 40;
	private isJoystickActive: boolean = false;
	private shootButton!: HTMLElement;
	private events: EventEmitter = new EventEmitter();
	private centerSection!: HTMLElement;
	private powerupPanel!: HTMLElement;
	private powerupOverlay!: HTMLElement;
	private canReroll: boolean = true;

	constructor(container: HTMLElement, player: PlayerCharacter) {
		this.player = player;
		this.container = container;
		this.elements = this.createUIElements();
		this.createTouchControls();
		this.updateUI();

		// Handle responsive UI
		window.addEventListener('resize', this.handleResize.bind(this));
		this.handleResize();
	}

	private handleResize(): void {
		const isMobile = window.innerWidth < 768;

		// Show/hide touch controls based on device
		if (isMobile) {
			this.touchControls.style.display = 'block';
			this.shootButton.style.display = 'none';

			// MOBILE UI IMPROVEMENTS: Clean up the top UI
			// Top bar styling
			this.topBar.style.padding = '6px 10px';
			this.topBar.style.height = '40px';
			this.topBar.style.zIndex = '100'; // Ensure topBar has higher z-index

			// Make sure the pause button is above touch controls
			this.pauseButton.style.zIndex = '100';
			this.pauseButton.style.position = 'relative'; // Ensure z-index works

			// Title - hide on mobile to save space
			this.centerSection.style.display = 'none';

			// Wave and score text - smaller and more compact
			this.waveText.style.fontSize = '0.8rem';
			this.scoreText.style.fontSize = '0.8rem';

			// Wave container and score container - more compact
			const waveContainer = this.waveText.parentElement;
			if (waveContainer) {
				waveContainer.style.padding = '4px 8px';
				waveContainer.style.zIndex = '100'; // Ensure it's above touch controls
			}

			const scoreContainer = this.scoreText.parentElement;
			if (scoreContainer) {
				scoreContainer.style.padding = '4px 8px';
				scoreContainer.style.zIndex = '100'; // Ensure it's above touch controls
			}

			// Pause button - smaller
			this.pauseButton.style.width = '28px';
			this.pauseButton.style.height = '28px';
			this.pauseButton.style.fontSize = '1.1rem';

			// Wave progress - move lower to avoid overlap with top bar
			this.waveProgressContainer.style.width = '85%';
			this.waveProgressContainer.style.top = '60px'; // Increased from 42px to 60px for more spacing
			this.waveProgressContainer.style.borderRadius = '6px';
			this.waveProgressContainer.style.zIndex = '100'; // Ensure it's above touch controls

			// Stats panel - position in bottom left with clean design
			this.elements.statsPanel.style.width = '120px';
			this.elements.statsPanel.style.padding = '8px';
			this.elements.statsPanel.style.borderRadius = '8px';
			this.elements.statsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
			this.elements.statsPanel.style.backdropFilter = 'blur(4px)';
			this.elements.statsPanel.style.position = 'fixed';
			this.elements.statsPanel.style.bottom = '20px';
			this.elements.statsPanel.style.left = '10px';
			this.elements.statsPanel.style.zIndex = '100'; // Ensure it's above touch controls
			this.elements.healthText.style.fontSize = '0.7rem';
			this.elements.levelText.style.fontSize = '0.7rem';

			// Make the HP text more concise on mobile
			const hpText = this.elements.healthText.textContent || '';
			if (hpText.startsWith('HP:')) {
				// Already in short format
			} else {
				const hpMatch = hpText.match(/(\d+)\/(\d+)/);
				if (hpMatch) {
					this.elements.healthText.textContent = `HP: ${hpMatch[1]}/${hpMatch[2]}`;
				}
			}
		} else {
			this.touchControls.style.display = 'none';
			this.shootButton.style.display = 'none';

			// Restore desktop styling
			this.topBar.style.padding = '10px 15px';
			this.topBar.style.height = 'auto';
			this.centerSection.style.display = 'block';
			this.waveText.style.fontSize = '0.9rem';
			this.scoreText.style.fontSize = '0.9rem';
			this.pauseButton.style.width = '35px';
			this.pauseButton.style.height = '35px';
			this.pauseButton.style.fontSize = '1.3rem';

			// Wave progress - desktop position
			this.waveProgressContainer.style.width = '220px';
			this.waveProgressContainer.style.top = '60px'; // Also slightly increased for consistency

			// Restore desktop stats panel
			this.elements.statsPanel.style.width = '180px';
			this.elements.statsPanel.style.padding = '10px';
			this.elements.statsPanel.style.position = 'static';
			this.elements.healthText.style.fontSize = '0.8rem';
			this.elements.levelText.style.fontSize = '0.8rem';
		}
	}

	private createUIElements(): UIElements {
		// Create UI container
		const uiContainer = document.createElement('div');
		uiContainer.className = 'game-ui';
		uiContainer.style.position = 'absolute';
		uiContainer.style.top = '0';
		uiContainer.style.left = '0';
		uiContainer.style.width = '100%';
		uiContainer.style.height = '100%';
		uiContainer.style.pointerEvents = 'none';
		uiContainer.style.fontFamily = 'Arial, sans-serif';
		uiContainer.style.color = 'white';
		uiContainer.style.textShadow = '1px 1px 0 #000';
		uiContainer.style.padding = '10px';
		uiContainer.style.boxSizing = 'border-box';
		uiContainer.style.display = 'flex';
		uiContainer.style.flexDirection = 'column';
		uiContainer.style.justifyContent = 'space-between';
		uiContainer.style.overflow = 'hidden';
		this.container.appendChild(uiContainer);

		// Top UI bar containing score and wave info - improved design
		const topBar = document.createElement('div');
		topBar.style.display = 'flex';
		topBar.style.justifyContent = 'space-between';
		topBar.style.alignItems = 'center';
		topBar.style.width = '100%';
		topBar.style.padding = '10px 15px';
		topBar.style.backgroundColor = 'rgba(0, 0, 30, 0.75)'; // Slightly more opaque
		topBar.style.backdropFilter = 'blur(8px)'; // Stronger blur for modern look
		topBar.style.borderBottom = '1px solid rgba(100, 120, 255, 0.3)';
		topBar.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
		uiContainer.appendChild(topBar);

		// Left section for wave info - modernized
		const leftSection = document.createElement('div');
		leftSection.style.display = 'flex';
		leftSection.style.alignItems = 'center';
		leftSection.style.gap = '15px';
		topBar.appendChild(leftSection);

		// Wave indicator with modern design
		const waveContainer = document.createElement('div');
		waveContainer.style.display = 'flex';
		waveContainer.style.alignItems = 'center';
		waveContainer.style.gap = '6px';
		waveContainer.style.backgroundColor = 'rgba(30, 40, 100, 0.6)';
		waveContainer.style.padding = '5px 10px';
		waveContainer.style.borderRadius = '8px';
		waveContainer.style.border = '1px solid rgba(100, 150, 255, 0.3)';
		leftSection.appendChild(waveContainer);

		// Modern wave icon
		const waveIcon = document.createElement('div');
		waveIcon.textContent = '🌊';
		waveIcon.style.fontSize = '0.9rem';
		waveContainer.appendChild(waveIcon);

		// Wave text - cleaner font
		const waveText = document.createElement('div');
		waveText.textContent = 'Wave 1';
		waveText.style.fontSize = '0.9rem';
		waveText.style.fontWeight = '600'; // Semibold instead of bold for cleaner look
		waveText.style.color = '#fff';
		waveContainer.appendChild(waveText);
		this.waveText = waveText;

		// Center section for title (smaller and less obtrusive)
		const centerSection = document.createElement('div');
		centerSection.style.position = 'absolute';
		centerSection.style.left = '50%';
		centerSection.style.transform = 'translateX(-50%)';
		centerSection.style.top = '5px';
		centerSection.style.textAlign = 'center';
		centerSection.style.pointerEvents = 'none';
		topBar.appendChild(centerSection);
		this.centerSection = centerSection;

		// Title text
		const titleText = document.createElement('div');
		titleText.textContent = 'CUBE SURVIVORS';
		titleText.style.fontSize = '1rem';
		titleText.style.fontWeight = 'bold';
		titleText.style.color = 'rgba(255, 255, 255, 0.7)';
		titleText.style.letterSpacing = '1px';
		titleText.style.textShadow = '0 0 10px rgba(100, 120, 255, 0.5)';
		centerSection.appendChild(titleText);

		// Right section for score and pause - modernized
		const rightSection = document.createElement('div');
		rightSection.style.display = 'flex';
		rightSection.style.alignItems = 'center';
		rightSection.style.gap = '10px';
		topBar.appendChild(rightSection);

		// Score display with modern design
		const scoreContainer = document.createElement('div');
		scoreContainer.style.display = 'flex';
		scoreContainer.style.alignItems = 'center';
		scoreContainer.style.gap = '5px';
		scoreContainer.style.backgroundColor = 'rgba(30, 40, 100, 0.6)';
		scoreContainer.style.padding = '5px 10px';
		scoreContainer.style.borderRadius = '8px';
		scoreContainer.style.border = '1px solid rgba(100, 150, 255, 0.3)';
		rightSection.appendChild(scoreContainer);

		// Score icon
		const scoreIcon = document.createElement('div');
		scoreIcon.textContent = '🏆';
		scoreIcon.style.fontSize = '0.9rem';
		scoreContainer.appendChild(scoreIcon);

		// Score text - cleaner font
		const scoreText = document.createElement('div');
		scoreText.textContent = 'Score: 0';
		scoreText.style.fontSize = '0.9rem';
		scoreText.style.fontWeight = '600'; // Semibold for cleaner look
		scoreText.style.color = '#fff';
		scoreContainer.appendChild(scoreText);
		this.scoreText = scoreText;

		// Pause button - improved modern design
		const pauseButton = document.createElement('div');
		pauseButton.textContent = '⏸️';
		pauseButton.style.fontSize = '1.3rem';
		pauseButton.style.cursor = 'pointer';
		pauseButton.style.backgroundColor = 'rgba(30, 40, 100, 0.6)';
		pauseButton.style.width = '35px';
		pauseButton.style.height = '35px';
		pauseButton.style.borderRadius = '8px'; // More rounded corners
		pauseButton.style.display = 'flex';
		pauseButton.style.justifyContent = 'center';
		pauseButton.style.alignItems = 'center';
		pauseButton.style.pointerEvents = 'auto';
		pauseButton.style.transition = 'all 0.2s ease-in-out';
		pauseButton.style.border = '1px solid rgba(100, 150, 255, 0.3)';

		pauseButton.onmouseover = () => {
			pauseButton.style.transform = 'scale(1.1)';
			pauseButton.style.backgroundColor = 'rgba(40, 60, 150, 0.8)';
		};

		pauseButton.onmouseout = () => {
			pauseButton.style.transform = 'scale(1)';
			pauseButton.style.backgroundColor = 'rgba(30, 40, 100, 0.6)';
		};

		// Emit custom event when pause button is clicked
		pauseButton.onclick = () => {
			const pauseEvent = new CustomEvent('toggle-pause');
			document.dispatchEvent(pauseEvent);
		};

		rightSection.appendChild(pauseButton);
		this.pauseButton = pauseButton;

		// Store topBar reference
		this.topBar = topBar;

		// Wave progress container - redesigned for mobile-first
		const waveProgressContainer = document.createElement('div');
		waveProgressContainer.style.display = 'flex';
		waveProgressContainer.style.flexDirection = 'column';
		waveProgressContainer.style.alignItems = 'center';
		waveProgressContainer.style.position = 'absolute';
		waveProgressContainer.style.top = '50px';
		waveProgressContainer.style.left = '50%';
		waveProgressContainer.style.transform = 'translateX(-50%)';
		waveProgressContainer.style.backgroundColor = 'rgba(10, 15, 35, 0.75)'; // Slightly more opaque
		waveProgressContainer.style.borderRadius = '10px'; // More rounded corners
		waveProgressContainer.style.width = '220px';
		waveProgressContainer.style.maxWidth = '90%'; // Responsive width
		waveProgressContainer.style.pointerEvents = 'none';
		waveProgressContainer.style.backdropFilter = 'blur(5px)'; // Stronger blur
		waveProgressContainer.style.border = '1px solid rgba(100, 120, 255, 0.25)'; // Subtler border
		waveProgressContainer.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
		waveProgressContainer.style.overflow = 'hidden';
		uiContainer.appendChild(waveProgressContainer);
		this.waveProgressContainer = waveProgressContainer;

		// Timer header section - simplified
		const timerHeader = document.createElement('div');
		timerHeader.style.display = 'flex';
		timerHeader.style.alignItems = 'center';
		timerHeader.style.justifyContent = 'center';
		timerHeader.style.width = '100%';
		timerHeader.style.padding = '6px 10px 3px 10px';
		timerHeader.style.backgroundColor = 'rgba(20, 30, 60, 0.4)'; // More transparent
		timerHeader.style.borderBottom = '1px solid rgba(100, 120, 255, 0.15)'; // Subtler border
		waveProgressContainer.appendChild(timerHeader);

		// Timer icon - unchanged
		const timerIcon = document.createElement('div');
		timerIcon.textContent = '⏱️';
		timerIcon.style.fontSize = '0.9rem';
		timerIcon.style.marginRight = '6px';
		timerHeader.appendChild(timerIcon);

		// Wave time text - cleaner styling
		const waveTimeText = document.createElement('div');
		waveTimeText.textContent = '30s';
		waveTimeText.style.color = 'white';
		waveTimeText.style.fontSize = '0.9rem';
		waveTimeText.style.fontWeight = '600'; // Semibold for cleaner look
		timerHeader.appendChild(waveTimeText);

		// Progress section - simplified
		const progressSection = document.createElement('div');
		progressSection.style.width = '100%';
		progressSection.style.padding = '6px 10px'; // Smaller padding
		progressSection.style.position = 'relative';
		waveProgressContainer.appendChild(progressSection);

		// Wave progress bar container - cleaner styling
		const waveProgressBarContainer = document.createElement('div');
		waveProgressBarContainer.style.width = '100%';
		waveProgressBarContainer.style.height = '6px'; // Thinner bar
		waveProgressBarContainer.style.backgroundColor = 'rgba(30, 40, 70, 0.5)';
		waveProgressBarContainer.style.borderRadius = '3px';
		waveProgressBarContainer.style.overflow = 'hidden';
		waveProgressBarContainer.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.2)'; // Subtler shadow
		progressSection.appendChild(waveProgressBarContainer);

		// Wave progress bar - modern gradient
		const waveProgressBar = document.createElement('div');
		waveProgressBar.style.height = '100%';
		waveProgressBar.style.width = '0%';
		waveProgressBar.style.borderRadius = '3px';
		waveProgressBar.style.transition = 'width 0.5s linear';
		waveProgressBar.style.background = 'linear-gradient(to right, #3498db, #9b59b6)'; // More modern color scheme
		waveProgressBar.style.boxShadow = '0 0 4px rgba(52, 152, 219, 0.4)'; // Subtler glow
		waveProgressBarContainer.appendChild(waveProgressBar);

		// Bottom container for player stats and controls
		const bottomContainer = document.createElement('div');
		bottomContainer.style.display = 'flex';
		bottomContainer.style.justifyContent = 'space-between';
		bottomContainer.style.width = '100%';
		bottomContainer.style.marginBottom = '10px';
		uiContainer.appendChild(bottomContainer);

		// Stats panel (health, level, etc) - modern redesign
		const statsPanel = document.createElement('div');
		statsPanel.style.backgroundColor = 'rgba(0, 10, 30, 0.7)';
		statsPanel.style.padding = '10px';
		statsPanel.style.borderRadius = '10px'; // More rounded corners
		statsPanel.style.width = '180px';
		statsPanel.style.backdropFilter = 'blur(5px)'; // Add blur for modern look
		statsPanel.style.border = '1px solid rgba(100, 150, 255, 0.2)'; // Subtle border
		statsPanel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)'; // Better shadow
		bottomContainer.appendChild(statsPanel);

		// Health label with compact design
		const healthLabel = document.createElement('div');
		healthLabel.textContent = 'Health';
		healthLabel.style.fontSize = '0.8rem';
		healthLabel.style.marginBottom = '3px';
		healthLabel.style.color = 'rgba(255, 255, 255, 0.9)';
		statsPanel.appendChild(healthLabel);

		// Health bar container - cleaner styling
		const healthBarContainer = document.createElement('div');
		healthBarContainer.style.width = '100%';
		healthBarContainer.style.height = '8px'; // Thinner bar
		healthBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
		healthBarContainer.style.border = '1px solid rgba(255, 255, 255, 0.15)'; // Subtler border
		healthBarContainer.style.borderRadius = '4px';
		healthBarContainer.style.overflow = 'hidden';
		statsPanel.appendChild(healthBarContainer);

		const healthBar = document.createElement('div');
		healthBar.style.width = '100%';
		healthBar.style.height = '100%';
		healthBar.style.backgroundColor = '#e74c3c';
		healthBar.style.borderRadius = '2px';
		healthBar.style.transition = 'width 0.3s ease-out';
		// Add gradient to health bar
		healthBar.style.background = 'linear-gradient(to right, #e74c3c, #f39c12)';
		healthBarContainer.appendChild(healthBar);

		const healthText = document.createElement('div');
		healthText.style.fontSize = '0.8rem';
		healthText.style.marginTop = '3px';
		healthText.style.marginBottom = '10px';
		healthText.textContent = 'HP: 100/100';
		statsPanel.appendChild(healthText);

		// Level and Experience
		const levelText = document.createElement('div');
		levelText.textContent = 'Level 1';
		levelText.style.fontSize = '0.8rem';
		levelText.style.marginBottom = '3px';
		statsPanel.appendChild(levelText);

		const expBarContainer = document.createElement('div');
		expBarContainer.style.width = '100%';
		expBarContainer.style.height = '10px';
		expBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
		expBarContainer.style.border = '1px solid rgba(255, 255, 255, 0.3)';
		expBarContainer.style.borderRadius = '3px';
		expBarContainer.style.overflow = 'hidden';
		statsPanel.appendChild(expBarContainer);

		const experienceBar = document.createElement('div');
		experienceBar.style.width = '0%';
		experienceBar.style.height = '100%';
		experienceBar.style.borderRadius = '2px';
		experienceBar.style.transition = 'width 0.3s ease-out';
		// Add gradient to experience bar
		experienceBar.style.background = 'linear-gradient(to right, #3498db, #9b59b6)';
		expBarContainer.appendChild(experienceBar);

		// Game Over Panel (hidden by default)
		const gameOverPanel = document.createElement('div');
		gameOverPanel.style.position = 'absolute';
		gameOverPanel.style.top = '50%';
		gameOverPanel.style.left = '50%';
		gameOverPanel.style.transform = 'translate(-50%, -50%)';
		gameOverPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
		gameOverPanel.style.padding = '20px 30px';
		gameOverPanel.style.borderRadius = '8px';
		gameOverPanel.style.textAlign = 'center';
		gameOverPanel.style.display = 'none';
		gameOverPanel.style.pointerEvents = 'auto';
		gameOverPanel.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
		gameOverPanel.style.border = '2px solid rgba(255, 255, 255, 0.2)';
		gameOverPanel.style.minWidth = '280px';
		uiContainer.appendChild(gameOverPanel);

		const gameOverTitle = document.createElement('h2');
		gameOverTitle.textContent = 'GAME OVER';
		gameOverTitle.style.color = '#e74c3c';
		gameOverTitle.style.fontSize = '2rem';
		gameOverTitle.style.marginBottom = '15px';
		gameOverTitle.style.textTransform = 'uppercase';
		gameOverTitle.style.letterSpacing = '2px';
		gameOverTitle.style.textShadow = '0 0 10px rgba(231, 76, 60, 0.7)';
		gameOverPanel.appendChild(gameOverTitle);

		const finalScoreText = document.createElement('div');
		finalScoreText.style.fontSize = '1.3rem';
		finalScoreText.style.marginBottom = '20px';
		finalScoreText.style.color = '#f1c40f';
		gameOverPanel.appendChild(finalScoreText);

		const restartButton = document.createElement('button');
		restartButton.textContent = 'RESTART GAME';
		restartButton.style.padding = '12px 25px';
		restartButton.style.backgroundColor = '#3498db';
		restartButton.style.border = 'none';
		restartButton.style.borderRadius = '5px';
		restartButton.style.color = 'white';
		restartButton.style.cursor = 'pointer';
		restartButton.style.fontSize = '1rem';
		restartButton.style.fontWeight = 'bold';
		restartButton.style.transition = 'all 0.2s ease';
		restartButton.style.letterSpacing = '1px';
		restartButton.style.boxShadow = '0 4px 0 rgba(41, 128, 185, 0.5)';

		restartButton.onmouseover = () => {
			restartButton.style.backgroundColor = '#2980b9';
			restartButton.style.transform = 'translateY(-2px)';
		};

		restartButton.onmouseout = () => {
			restartButton.style.backgroundColor = '#3498db';
			restartButton.style.transform = 'translateY(0)';
		};

		restartButton.onmousedown = () => {
			restartButton.style.boxShadow = '0 2px 0 rgba(41, 128, 185, 0.5)';
			restartButton.style.transform = 'translateY(2px)';
		};

		restartButton.onmouseup = () => {
			restartButton.style.boxShadow = '0 4px 0 rgba(41, 128, 185, 0.5)';
			restartButton.style.transform = 'translateY(0)';
		};

		restartButton.onclick = () => window.location.reload();
		gameOverPanel.appendChild(restartButton);

		// Create pause panel (hidden by default)
		const pausePanel = document.createElement('div');
		pausePanel.style.position = 'absolute';
		pausePanel.style.top = '50%';
		pausePanel.style.left = '50%';
		pausePanel.style.transform = 'translate(-50%, -50%)';
		pausePanel.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
		pausePanel.style.padding = '20px 30px';
		pausePanel.style.borderRadius = '8px';
		pausePanel.style.textAlign = 'center';
		pausePanel.style.display = 'none';
		pausePanel.style.pointerEvents = 'auto';
		pausePanel.style.boxShadow = '0 0 30px rgba(0, 0, 255, 0.3)';
		pausePanel.style.border = '2px solid rgba(100, 150, 255, 0.5)';
		pausePanel.style.minWidth = '280px';
		pausePanel.style.zIndex = '2000';
		uiContainer.appendChild(pausePanel);

		// Pause title
		const pauseTitle = document.createElement('h2');
		pauseTitle.textContent = 'PAUSED';
		pauseTitle.style.color = '#3498db';
		pauseTitle.style.fontSize = '2.5rem';
		pauseTitle.style.marginBottom = '20px';
		pauseTitle.style.textTransform = 'uppercase';
		pauseTitle.style.letterSpacing = '3px';
		pauseTitle.style.textShadow = '0 0 15px rgba(52, 152, 219, 0.7)';
		pausePanel.appendChild(pauseTitle);

		// Controls instructions
		const controlsInfo = document.createElement('div');
		controlsInfo.style.marginBottom = '20px';
		controlsInfo.style.color = '#fff';
		controlsInfo.style.fontSize = '1rem';
		controlsInfo.style.lineHeight = '1.5';

		const isMobile = window.innerWidth < 768;
		if (isMobile) {
			controlsInfo.innerHTML = `
				<p>Use joystick to move</p>
				<p>Weapons fire automatically</p>
				<p>Tap the pause button to resume</p>
			`;
		} else {
			controlsInfo.innerHTML = `
				<p>W, A, S, D - Move</p>
				<p>Weapons fire automatically</p>
				<p>ESC or P - Resume Game</p>
			`;
		}
		pausePanel.appendChild(controlsInfo);

		// Container for buttons
		const buttonContainer = document.createElement('div');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'center';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '10px';
		pausePanel.appendChild(buttonContainer);

		// Resume button
		const resumeButton = document.createElement('button');
		resumeButton.textContent = 'RESUME GAME';
		resumeButton.style.padding = '10px 20px';
		resumeButton.style.backgroundColor = '#3498db';
		resumeButton.style.border = 'none';
		resumeButton.style.borderRadius = '5px';
		resumeButton.style.color = 'white';
		resumeButton.style.cursor = 'pointer';
		resumeButton.style.fontSize = '1rem';
		resumeButton.style.fontWeight = 'bold';
		resumeButton.style.transition = 'all 0.2s ease';
		resumeButton.style.letterSpacing = '1px';
		resumeButton.style.boxShadow = '0 4px 0 rgba(41, 128, 185, 0.5)';
		resumeButton.style.margin = '0 10px';

		// Button hover and click effects
		resumeButton.onmouseover = () => {
			resumeButton.style.backgroundColor = '#2980b9';
			resumeButton.style.transform = 'translateY(-2px)';
		};

		resumeButton.onmouseout = () => {
			resumeButton.style.backgroundColor = '#3498db';
			resumeButton.style.transform = 'translateY(0)';
		};

		resumeButton.onmousedown = () => {
			resumeButton.style.boxShadow = '0 2px 0 rgba(41, 128, 185, 0.5)';
			resumeButton.style.transform = 'translateY(2px)';
		};

		resumeButton.onmouseup = () => {
			resumeButton.style.boxShadow = '0 4px 0 rgba(41, 128, 185, 0.5)';
			resumeButton.style.transform = 'translateY(0)';
		};

		buttonContainer.appendChild(resumeButton);

		// Exit button
		const exitButton = document.createElement('button');
		exitButton.textContent = 'EXIT TO MENU';
		exitButton.style.padding = '10px 20px';
		exitButton.style.backgroundColor = '#e74c3c';
		exitButton.style.border = 'none';
		exitButton.style.borderRadius = '5px';
		exitButton.style.color = 'white';
		exitButton.style.cursor = 'pointer';
		exitButton.style.fontSize = '1rem';
		exitButton.style.fontWeight = 'bold';
		exitButton.style.transition = 'all 0.2s ease';
		exitButton.style.letterSpacing = '1px';
		exitButton.style.boxShadow = '0 4px 0 rgba(192, 57, 43, 0.5)';
		exitButton.style.margin = '0 10px';

		// Button hover and click effects
		exitButton.onmouseover = () => {
			exitButton.style.backgroundColor = '#c0392b';
			exitButton.style.transform = 'translateY(-2px)';
		};

		exitButton.onmouseout = () => {
			exitButton.style.backgroundColor = '#e74c3c';
			exitButton.style.transform = 'translateY(0)';
		};

		exitButton.onmousedown = () => {
			exitButton.style.boxShadow = '0 2px 0 rgba(192, 57, 43, 0.5)';
			exitButton.style.transform = 'translateY(2px)';
		};

		exitButton.onmouseup = () => {
			exitButton.style.boxShadow = '0 4px 0 rgba(192, 57, 43, 0.5)';
			exitButton.style.transform = 'translateY(0)';
		};

		// Use a custom event to exit the game
		exitButton.onclick = () => {
			const exitEvent = new CustomEvent('exit-game');
			document.dispatchEvent(exitEvent);
		};

		buttonContainer.appendChild(exitButton);

		// Create pause overlay (dimmed background)
		const pauseOverlay = document.createElement('div');
		pauseOverlay.style.position = 'absolute';
		pauseOverlay.style.top = '0';
		pauseOverlay.style.left = '0';
		pauseOverlay.style.width = '100%';
		pauseOverlay.style.height = '100%';
		pauseOverlay.style.backgroundColor = 'rgba(0, 10, 30, 0.5)';
		pauseOverlay.style.display = 'none';
		pauseOverlay.style.zIndex = '1500';
		uiContainer.appendChild(pauseOverlay);

		// Create shoot button
		const shootButton = document.createElement('div');
		shootButton.style.position = 'absolute';
		shootButton.style.bottom = '30px';
		shootButton.style.right = '30px';
		shootButton.style.width = '80px';
		shootButton.style.height = '80px';
		shootButton.style.borderRadius = '50%';
		shootButton.style.backgroundColor = 'rgba(200, 50, 50, 0.4)';
		shootButton.style.border = '2px solid rgba(255, 100, 100, 0.4)';
		shootButton.style.backdropFilter = 'blur(3px)';
		shootButton.style.boxSizing = 'border-box';
		shootButton.style.display = 'none'; // Hidden by default, shown on mobile
		shootButton.style.zIndex = '1000';
		shootButton.style.boxShadow = '0 0 15px rgba(255, 100, 100, 0.3)';
		this.container.appendChild(shootButton);

		// Add FIRE text
		const shootButtonLabel = document.createElement('div');
		shootButtonLabel.textContent = 'AUTO';
		shootButtonLabel.style.position = 'absolute';
		shootButtonLabel.style.top = '50%';
		shootButtonLabel.style.left = '50%';
		shootButtonLabel.style.transform = 'translate(-50%, -50%)';
		shootButtonLabel.style.fontSize = '16px';
		shootButtonLabel.style.fontWeight = 'bold';
		shootButtonLabel.style.color = 'rgba(255, 255, 255, 0.8)';
		shootButtonLabel.style.pointerEvents = 'none';
		shootButton.appendChild(shootButtonLabel);

		// Create a dark overlay for powerup selection
		const powerupOverlay = document.createElement('div');
		powerupOverlay.style.position = 'absolute';
		powerupOverlay.style.top = '0';
		powerupOverlay.style.left = '0';
		powerupOverlay.style.width = '100%';
		powerupOverlay.style.height = '100%';
		powerupOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
		powerupOverlay.style.zIndex = '2000';
		powerupOverlay.style.backdropFilter = 'blur(3px)';
		powerupOverlay.style.display = 'none';
		this.container.appendChild(powerupOverlay);
		this.powerupOverlay = powerupOverlay;

		// Create powerup selection panel
		const powerupPanel = document.createElement('div');
		powerupPanel.style.position = 'absolute';
		powerupPanel.style.top = '50%';
		powerupPanel.style.left = '50%';
		powerupPanel.style.transform = 'translate(-50%, -50%)';
		powerupPanel.style.backgroundColor = 'rgba(10, 20, 50, 0.95)';
		powerupPanel.style.borderRadius = '10px';
		powerupPanel.style.padding = '20px';
		powerupPanel.style.minWidth = '320px';
		powerupPanel.style.maxWidth = '90%';
		powerupPanel.style.boxShadow = '0 0 20px rgba(100, 200, 255, 0.5)';
		powerupPanel.style.border = '2px solid rgba(100, 150, 255, 0.5)';
		powerupPanel.style.zIndex = '2001';
		powerupPanel.style.display = 'none';
		powerupPanel.style.pointerEvents = 'auto';
		powerupPanel.style.textAlign = 'center';
		this.container.appendChild(powerupPanel);
		this.powerupPanel = powerupPanel;

		return {
			healthBar,
			healthText,
			levelText,
			experienceBar,
			scoreText,
			gameOverPanel,
			waveText,
			waveProgressBar,
			waveTimeText,
			statsPanel,
			pausePanel,
			pauseButton,
			pauseOverlay
		};
	}

	public updateUI(): void {
		// Update health bar
		const healthPercent = (this.player.getHealth() / this.player.getMaxHealth()) * 100;
		this.elements.healthBar.style.width = `${healthPercent}%`;

		// Use a more concise format for mobile
		const isMobile = window.innerWidth < 768;
		if (isMobile) {
			this.elements.healthText.textContent = `HP: ${this.player.getHealth()}/${this.player.getMaxHealth()}`;
		} else {
			this.elements.healthText.textContent = `HP: ${this.player.getHealth()}/${this.player.getMaxHealth()}`;
		}

		// Check if level has changed
		const currentLevel = this.player.getLevel();
		const displayedLevel = parseInt(
			this.elements.levelText.textContent?.replace('Level ', '') || '1'
		);

		if (currentLevel > displayedLevel) {
			// Level up animation
			this.showLevelUpNotification(currentLevel);
		}

		// Update level and experience text
		this.elements.levelText.textContent = `Level ${currentLevel}`;
		const expPercent = (this.player.getExperience() / this.player.getExperienceToNextLevel()) * 100;
		this.elements.experienceBar.style.width = `${expPercent}%`;

		// Update score
		this.scoreText.textContent = `Score: ${this.score}`;
	}

	private showLevelUpNotification(level: number): void {
		// Create a level up notification first
		const notification = document.createElement('div');
		notification.textContent = `LEVEL UP! ${level}`;
		notification.style.position = 'absolute';
		notification.style.top = '30%';
		notification.style.left = '50%';
		notification.style.transform = 'translate(-50%, -50%) scale(0.5)';
		notification.style.color = '#ffdd00';
		notification.style.fontSize = '3rem';
		notification.style.fontWeight = 'bold';
		notification.style.textShadow =
			'0 0 10px rgba(255, 221, 0, 0.7), 0 0 20px rgba(255, 221, 0, 0.5)';
		notification.style.pointerEvents = 'none';
		notification.style.zIndex = '2002';
		notification.style.opacity = '0';
		notification.style.letterSpacing = '3px';
		notification.style.textAlign = 'center';
		notification.style.whiteSpace = 'nowrap';

		this.container.appendChild(notification);

		// Define animation
		const keyframeStyle = document.createElement('style');
		keyframeStyle.textContent = `
			@keyframes levelUpNotification {
				0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
				20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
				80% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
				100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
			}
		`;
		document.head.appendChild(keyframeStyle);

		// Apply animation
		notification.style.animation = 'levelUpNotification 2s forwards';

		// Show powerup selection after brief delay
		setTimeout(() => {
			this.showPowerupSelection(level);

			// Clean up the notification
			setTimeout(() => {
				this.container.removeChild(notification);
				document.head.removeChild(keyframeStyle);
			}, 500);
		}, 1500);
	}

	// Available powerups
	private powerups: Powerup[] = [
		{
			id: 'damage',
			name: 'Damage Boost',
			description: 'Increase damage by 15%',
			icon: '💥',
			color: '#ff5555'
		},
		{
			id: 'speed',
			name: 'Speed Boost',
			description: 'Increase movement speed by 15%',
			icon: '🏃',
			color: '#55ff55'
		},
		{
			id: 'health',
			name: 'Max Health',
			description: 'Increase maximum health by 10%',
			icon: '❤️',
			color: '#ff5555'
		},
		{
			id: 'regen',
			name: 'Health Regen',
			description: 'Regenerate 1 health every 5 seconds',
			icon: '💚',
			color: '#55ff99'
		},
		{
			id: 'attackSpeed',
			name: 'Attack Speed',
			description: 'Increase attack speed by 15%',
			icon: '⚡',
			color: '#ffff55'
		},
		{
			id: 'critChance',
			name: 'Critical Hits',
			description: '10% chance to deal double damage',
			icon: '🎯',
			color: '#ff9955'
		},
		{
			id: 'multishot',
			name: 'Multishot',
			description: 'Fire an additional projectile',
			icon: '🔱',
			color: '#5555ff'
		},
		{
			id: 'range',
			name: 'Attack Range',
			description: 'Increase attack range by 15%',
			icon: '📏',
			color: '#55ffff'
		},
		{
			id: 'pierce',
			name: 'Piercing Shot',
			description: 'Projectiles pierce through enemies',
			icon: '↗️',
			color: '#ff55ff'
		},
		{
			id: 'magnet',
			name: 'Item Magnet',
			description: 'Automatically collect nearby items',
			icon: '🧲',
			color: '#aaaaff'
		},
		{
			id: 'shield',
			name: 'Shield',
			description: 'Block the next hit taken',
			icon: '🛡️',
			color: '#aaaaaa'
		},
		{
			id: 'poison',
			name: 'Poison Shots',
			description: 'Shots apply poison damage over time',
			icon: '☠️',
			color: '#99ff55'
		}
	];

	private getRandomPowerups(count: number): Powerup[] {
		// Create a copy of powerups
		const availablePowerups = [...this.powerups];
		const randomPowerups = [];

		// Select random powerups
		for (let i = 0; i < count; i++) {
			if (availablePowerups.length === 0) break;

			const randomIndex = Math.floor(Math.random() * availablePowerups.length);
			randomPowerups.push(availablePowerups.splice(randomIndex, 1)[0]);
		}

		return randomPowerups;
	}

	private showPowerupSelection(level: number): void {
		// Reset the panel
		this.powerupPanel.innerHTML = '';

		// Reset reroll ability for this level up
		this.canReroll = true;

		// Show overlay and panel
		this.powerupOverlay.style.display = 'block';
		this.powerupPanel.style.display = 'block';

		// Create title
		const title = document.createElement('h2');
		title.textContent = `LEVEL ${level}: SELECT A POWERUP`;
		title.style.color = '#ffdd00';
		title.style.margin = '0 0 20px 0';
		title.style.fontSize = '1.8rem';
		title.style.textAlign = 'center';
		title.style.textShadow = '0 0 10px rgba(255, 221, 0, 0.5)';
		this.powerupPanel.appendChild(title);

		// Add subtitle
		const subtitle = document.createElement('p');
		subtitle.textContent = 'Choose one powerup to enhance your character';
		subtitle.style.color = '#ffffff';
		subtitle.style.margin = '0 0 20px 0';
		subtitle.style.fontSize = '1rem';
		this.powerupPanel.appendChild(subtitle);

		// Get 3 random powerups
		const randomPowerups = this.getRandomPowerups(3);

		// Create powerup cards container
		const cardsContainer = document.createElement('div');
		cardsContainer.style.display = 'flex';
		cardsContainer.style.justifyContent = 'center';
		cardsContainer.style.gap = '15px';
		cardsContainer.style.marginBottom = '20px';
		cardsContainer.style.flexWrap = 'wrap';
		this.powerupPanel.appendChild(cardsContainer);

		// Create cards for each powerup
		randomPowerups.forEach((powerup) => {
			const card = document.createElement('div');
			card.style.backgroundColor = 'rgba(30, 40, 60, 0.9)';
			card.style.border = `2px solid ${powerup.color}`;
			card.style.borderRadius = '8px';
			card.style.padding = '15px';
			card.style.width = '140px';
			card.style.cursor = 'pointer';
			card.style.transition = 'transform 0.2s, box-shadow 0.2s';
			card.style.boxShadow = `0 0 10px rgba(0, 0, 0, 0.5)`;

			// Hover effect
			card.onmouseover = () => {
				card.style.transform = 'scale(1.05)';
				card.style.boxShadow = `0 0 15px ${powerup.color}`;
			};

			card.onmouseout = () => {
				card.style.transform = 'scale(1)';
				card.style.boxShadow = `0 0 10px rgba(0, 0, 0, 0.5)`;
			};

			// Click event to select powerup
			card.onclick = () => {
				this.selectPowerup(powerup);
			};

			// Icon
			const icon = document.createElement('div');
			icon.textContent = powerup.icon;
			icon.style.fontSize = '2.5rem';
			icon.style.marginBottom = '10px';
			icon.style.textShadow = `0 0 10px ${powerup.color}`;
			card.appendChild(icon);

			// Name
			const name = document.createElement('div');
			name.textContent = powerup.name;
			name.style.fontWeight = 'bold';
			name.style.fontSize = '1rem';
			name.style.marginBottom = '8px';
			name.style.color = powerup.color;
			card.appendChild(name);

			// Description
			const desc = document.createElement('div');
			desc.textContent = powerup.description;
			desc.style.fontSize = '0.8rem';
			desc.style.color = '#cccccc';
			card.appendChild(desc);

			cardsContainer.appendChild(card);
		});

		// Add reroll button
		const rerollButton = document.createElement('button');
		rerollButton.textContent = 'REROLL POWERUPS';
		rerollButton.style.padding = '10px 20px';
		rerollButton.style.backgroundColor = this.canReroll
			? 'rgba(100, 150, 255, 0.7)'
			: 'rgba(80, 80, 80, 0.7)';
		rerollButton.style.color = this.canReroll ? 'white' : '#aaaaaa';
		rerollButton.style.border = 'none';
		rerollButton.style.borderRadius = '5px';
		rerollButton.style.fontSize = '1rem';
		rerollButton.style.cursor = this.canReroll ? 'pointer' : 'not-allowed';
		rerollButton.style.marginTop = '15px';
		rerollButton.style.transition = 'background-color 0.2s, transform 0.2s';

		if (this.canReroll) {
			rerollButton.onmouseover = () => {
				rerollButton.style.backgroundColor = 'rgba(120, 170, 255, 0.8)';
				rerollButton.style.transform = 'scale(1.05)';
			};

			rerollButton.onmouseout = () => {
				rerollButton.style.backgroundColor = 'rgba(100, 150, 255, 0.7)';
				rerollButton.style.transform = 'scale(1)';
			};

			rerollButton.onclick = () => {
				if (this.canReroll) {
					this.canReroll = false;
					this.showPowerupSelection(level);
				}
			};
		}

		this.powerupPanel.appendChild(rerollButton);

		// Add a small note about reroll
		const rerollNote = document.createElement('div');
		rerollNote.textContent = '(Can only reroll once per level)';
		rerollNote.style.fontSize = '0.7rem';
		rerollNote.style.color = '#aaaaaa';
		rerollNote.style.marginTop = '5px';
		this.powerupPanel.appendChild(rerollNote);

		// Emit event to pause the game
		const pauseEvent = new CustomEvent('pause-for-powerup');
		document.dispatchEvent(pauseEvent);
	}

	private selectPowerup(powerup: Powerup): void {
		// Hide powerup panel and overlay
		this.powerupPanel.style.display = 'none';
		this.powerupOverlay.style.display = 'none';

		// Show selected powerup notification
		const notification = document.createElement('div');
		notification.style.position = 'absolute';
		notification.style.top = '50%';
		notification.style.left = '50%';
		notification.style.transform = 'translate(-50%, -50%)';
		notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
		notification.style.borderRadius = '10px';
		notification.style.padding = '15px 25px';
		notification.style.textAlign = 'center';
		notification.style.zIndex = '2000';
		notification.style.opacity = '0';
		notification.style.animation = 'fadeInOut 2s forwards';

		// Add @keyframes for fadeInOut if it doesn't exist
		if (!document.querySelector('#fadeInOut-keyframes')) {
			const styleSheet = document.createElement('style');
			styleSheet.id = 'fadeInOut-keyframes';
			styleSheet.textContent = `
				@keyframes fadeInOut {
					0% { opacity: 0; transform: translate(-50%, -70%); }
					20% { opacity: 1; transform: translate(-50%, -50%); }
					80% { opacity: 1; transform: translate(-50%, -50%); }
					100% { opacity: 0; transform: translate(-50%, -30%); }
				}
			`;
			document.head.appendChild(styleSheet);
		}

		// Icon and name
		const content = document.createElement('div');
		content.innerHTML = `<div style="font-size: 2rem; margin-bottom: 10px;">${powerup.icon}</div>
							<div style="font-size: 1.2rem; font-weight: bold; color: ${powerup.color};">${powerup.name}</div>
							<div style="color: #ccc;">${powerup.description}</div>`;
		notification.appendChild(content);

		this.container.appendChild(notification);

		// Clean up after animation
		setTimeout(() => {
			this.container.removeChild(notification);
		}, 2000);

		// Emit event with selected powerup
		const powerupEvent = new CustomEvent('powerup-selected', {
			detail: {
				powerupId: powerup.id
			}
		});
		document.dispatchEvent(powerupEvent);

		// Emit event to resume the game
		setTimeout(() => {
			const resumeEvent = new CustomEvent('resume-from-powerup');
			document.dispatchEvent(resumeEvent);
		}, 500);
	}

	public setWave(wave: number): void {
		// Only update and flash when wave actually changes
		if (this.waveNumber !== wave) {
			this.waveNumber = wave;
			this.waveText.textContent = `Wave ${wave}`;

			// Flash the wave text when it changes
			this.waveText.style.transform = 'scale(1.2)';
			this.waveText.style.color = '#f39c12';

			setTimeout(() => {
				this.waveText.style.transform = 'scale(1)';
				this.waveText.style.color = 'white';
			}, 500);
		}
	}

	public addScore(points: number): void {
		this.score += points;
		this.updateUI();

		// Update score text
		this.scoreText.textContent = `Score: ${this.score}`;

		// Create floating score text for visual feedback
		const floatingText = document.createElement('div');
		floatingText.textContent = `+${points}`;
		floatingText.style.position = 'absolute';
		floatingText.style.top = '50%';
		floatingText.style.left = '50%';
		floatingText.style.transform = 'translate(-50%, -50%)';
		floatingText.style.color = '#f1c40f';
		floatingText.style.fontSize = '1.5rem';
		floatingText.style.fontWeight = 'bold';
		floatingText.style.textShadow = '0 0 3px black';
		floatingText.style.pointerEvents = 'none';
		floatingText.style.animation = 'float-up 1s forwards';

		// Add keyframes style with ID if it doesn't exist already
		if (!document.querySelector('#float-up-keyframes')) {
			const styleSheet = document.createElement('style');
			styleSheet.id = 'float-up-keyframes';
			styleSheet.textContent = `
      @keyframes float-up {
        0% { opacity: 1; transform: translate(-50%, -50%); }
        100% { opacity: 0; transform: translate(-50%, -150%); }
      }
    `;
			document.head.appendChild(styleSheet);
		}

		this.container.appendChild(floatingText);

		setTimeout(() => {
			this.container.removeChild(floatingText);
		}, 1000);
	}

	public showGameOver(score: number): void {
		// Update final score text
		const finalScoreElement = this.elements.gameOverPanel.querySelector('div');
		if (finalScoreElement) {
			finalScoreElement.textContent = `Final Score: ${score}`;
		}

		// Show the game over panel
		this.elements.gameOverPanel.style.display = 'block';

		// Add fade-in animation
		this.elements.gameOverPanel.style.animation = 'fadeIn 0.5s ease-in-out forwards';

		// Add @keyframes for fadeIn if it doesn't exist
		if (!document.querySelector('#game-ui-keyframes')) {
			const styleSheet = document.createElement('style');
			styleSheet.id = 'game-ui-keyframes';
			styleSheet.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -60%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `;
			document.head.appendChild(styleSheet);
		}
	}

	public cleanup(): void {
		window.removeEventListener('resize', this.handleResize.bind(this));
		const uiContainer = this.elements.healthBar.parentElement?.parentElement?.parentElement;
		if (uiContainer) {
			this.container.removeChild(uiContainer);
		}
	}

	public updateWaveProgress(progressPercentage: number, timeRemaining: number): void {
		// Update progress bar width
		this.elements.waveProgressBar.style.width = `${progressPercentage}%`;

		// Update time text with formatting
		const seconds = Math.floor(timeRemaining);
		this.elements.waveTimeText.textContent = `${seconds}s`;

		// Add visual urgency based on time remaining
		if (timeRemaining < 5) {
			// Critical time - pulse animation and red color
			this.elements.waveTimeText.style.color = '#ff3333';
			this.elements.waveTimeText.style.animation = 'pulse-urgent 0.6s infinite';
			// Make progress bar pulse with glow
			this.elements.waveProgressBar.style.animation = 'glow-pulse 0.6s infinite';
		} else if (timeRemaining < 10) {
			// Warning time - orange color
			this.elements.waveTimeText.style.color = '#ff9933';
			this.elements.waveTimeText.style.animation = 'pulse-warning 1s infinite';
			this.elements.waveProgressBar.style.animation = 'none';
		} else {
			// Normal time
			this.elements.waveTimeText.style.color = 'white';
			this.elements.waveTimeText.style.animation = 'none';
			this.elements.waveProgressBar.style.animation = 'none';
		}

		// Add keyframes if they don't exist
		if (!document.querySelector('#wave-timer-animations')) {
			const styleSheet = document.createElement('style');
			styleSheet.id = 'wave-timer-animations';
			styleSheet.textContent = `
				@keyframes pulse-urgent {
					0% { transform: scale(1); text-shadow: 0 0 5px rgba(255, 0, 0, 0.5); }
					50% { transform: scale(1.15); text-shadow: 0 0 10px rgba(255, 0, 0, 0.8); }
					100% { transform: scale(1); text-shadow: 0 0 5px rgba(255, 0, 0, 0.5); }
				}
				@keyframes pulse-warning {
					0% { transform: scale(1); }
					50% { transform: scale(1.1); }
					100% { transform: scale(1); }
				}
				@keyframes glow-pulse {
					0% { box-shadow: 0 0 5px rgba(255, 0, 0, 0.5); }
					50% { box-shadow: 0 0 15px rgba(255, 0, 0, 0.9); }
					100% { box-shadow: 0 0 5px rgba(255, 0, 0, 0.5); }
				}
			`;
			document.head.appendChild(styleSheet);
		}
	}

	public showPauseScreen(): void {
		// Get the pause container and overlay
		const pausePanel = this.elements.pausePanel;
		const pauseOverlay = this.elements.pauseOverlay;

		// Show overlay with fade-in
		pauseOverlay.style.display = 'block';
		pauseOverlay.style.animation = 'fadeIn 0.3s forwards';

		// Show pause panel
		pausePanel.style.display = 'block';
		pausePanel.style.animation = 'pauseFadeIn 0.3s ease-in-out forwards';

		// Add @keyframes for pauseFadeIn if it doesn't exist
		if (!document.querySelector('#pause-keyframes')) {
			const styleSheet = document.createElement('style');
			styleSheet.id = 'pause-keyframes';
			styleSheet.textContent = `
				@keyframes pauseFadeIn {
					from { opacity: 0; transform: translate(-50%, -55%); }
					to { opacity: 1; transform: translate(-50%, -50%); }
				}
				@keyframes fadeIn {
					from { opacity: 0; }
					to { opacity: 1; }
				}
			`;
			document.head.appendChild(styleSheet);
		}

		// Set up resume button click event
		const resumeButton = pausePanel.querySelector('button');
		if (resumeButton) {
			// Use a custom event to communicate with the game
			resumeButton.onclick = () => {
				const resumeEvent = new CustomEvent('resume-game');
				document.dispatchEvent(resumeEvent);
			};
		}
	}

	public hidePauseScreen(): void {
		const pausePanel = this.elements.pausePanel;
		const pauseOverlay = this.elements.pauseOverlay;

		// Add fade-out animation
		pausePanel.style.animation = 'pauseFadeOut 0.2s ease-in-out forwards';
		pauseOverlay.style.animation = 'fadeOut 0.2s forwards';

		// Add @keyframes for pauseFadeOut if it doesn't exist
		if (!document.querySelector('#pause-out-keyframes')) {
			const styleSheet = document.createElement('style');
			styleSheet.id = 'pause-out-keyframes';
			styleSheet.textContent = `
				@keyframes pauseFadeOut {
					from { opacity: 1; transform: translate(-50%, -50%); }
					to { opacity: 0; transform: translate(-50%, -45%); }
				}
				@keyframes fadeOut {
					from { opacity: 1; }
					to { opacity: 0; }
				}
			`;
			document.head.appendChild(styleSheet);
		}

		// Actually hide panels after animation completes
		setTimeout(() => {
			pausePanel.style.display = 'none';
			pauseOverlay.style.display = 'none';
		}, 200);
	}

	private createTouchControls(): void {
		// Create container for touch controls - this will cover the entire screen for touch detection
		const touchControls = document.createElement('div');
		touchControls.style.position = 'absolute';
		touchControls.style.top = '0';
		touchControls.style.left = '0';
		touchControls.style.width = '100%';
		touchControls.style.height = '100%';
		touchControls.style.pointerEvents = 'auto';
		touchControls.style.zIndex = '5'; // Low z-index to be below UI elements
		touchControls.style.display = 'none'; // Hidden by default, shown on mobile

		// Add a class for easier identification
		touchControls.className = 'touch-controls-overlay';

		this.container.appendChild(touchControls);

		// Create floating joystick background - hidden by default
		const joystickContainer = document.createElement('div');
		joystickContainer.style.position = 'absolute';
		joystickContainer.style.width = '120px';
		joystickContainer.style.height = '120px';
		joystickContainer.style.borderRadius = '50%';
		joystickContainer.style.backgroundColor = 'rgba(20, 30, 60, 0.4)';
		joystickContainer.style.border = '2px solid rgba(100, 150, 255, 0.4)';
		joystickContainer.style.backdropFilter = 'blur(3px)';
		joystickContainer.style.boxSizing = 'border-box';
		joystickContainer.style.display = 'none'; // Hidden until touch starts
		joystickContainer.style.transform = 'translate(-50%, -50%)'; // Center at touch point
		joystickContainer.style.zIndex = '10'; // Above the touchControls but below UI

		this.container.appendChild(joystickContainer);

		// Create joystick handle
		const joystickHandle = document.createElement('div');
		joystickHandle.style.position = 'absolute';
		joystickHandle.style.top = '50%';
		joystickHandle.style.left = '50%';
		joystickHandle.style.transform = 'translate(-50%, -50%)';
		joystickHandle.style.width = '50px';
		joystickHandle.style.height = '50px';
		joystickHandle.style.borderRadius = '50%';
		joystickHandle.style.backgroundColor = 'rgba(100, 150, 255, 0.7)';
		joystickHandle.style.border = '2px solid rgba(150, 200, 255, 0.8)';
		joystickHandle.style.boxShadow = '0 0 15px rgba(100, 150, 255, 0.5)';

		// Add crosshairs inside handle for better visual feedback
		const crosshair = document.createElement('div');
		crosshair.style.position = 'absolute';
		crosshair.style.top = '50%';
		crosshair.style.left = '50%';
		crosshair.style.transform = 'translate(-50%, -50%)';
		crosshair.style.width = '20px';
		crosshair.style.height = '20px';
		crosshair.style.pointerEvents = 'none';

		// Horizontal line
		const hLine = document.createElement('div');
		hLine.style.position = 'absolute';
		hLine.style.top = '50%';
		hLine.style.left = '0';
		hLine.style.width = '100%';
		hLine.style.height = '2px';
		hLine.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
		hLine.style.transform = 'translateY(-50%)';
		crosshair.appendChild(hLine);

		// Vertical line
		const vLine = document.createElement('div');
		vLine.style.position = 'absolute';
		vLine.style.top = '0';
		vLine.style.left = '50%';
		vLine.style.width = '2px';
		vLine.style.height = '100%';
		vLine.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
		vLine.style.transform = 'translateX(-50%)';
		crosshair.appendChild(vLine);

		joystickHandle.appendChild(crosshair);
		joystickContainer.appendChild(joystickHandle);

		// Create shoot button but don't show it
		const shootButton = document.createElement('div');
		shootButton.style.display = 'none'; // Always hidden since game auto-attacks
		this.container.appendChild(shootButton);

		// Store references
		this.touchControls = touchControls;
		this.joystickContainer = joystickContainer;
		this.joystickHandle = joystickHandle;
		this.shootButton = shootButton;

		// Add touch event listeners
		this.setupTouchEvents();
	}

	private setupTouchEvents(): void {
		// Touch start - when user touches anywhere on the screen
		this.touchControls.addEventListener('touchstart', (e) => {
			// Get the touch
			const touch = e.touches[0];

			// Check if touch is in the top UI area
			const topUIHeight = 100; // Approximate height of the top UI area
			if (touch.clientY < topUIHeight) {
				return; // Don't activate joystick if touching top UI area
			}

			// Check if touching stats panel area in bottom left
			const statsPanel = this.elements.statsPanel;
			const statsPanelRect = statsPanel.getBoundingClientRect();
			if (
				touch.clientX < statsPanelRect.right &&
				touch.clientY > window.innerHeight - statsPanelRect.height - 40
			) {
				return; // Don't activate joystick if touching stats panel area
			}

			e.preventDefault();
			this.handleTouchStart(e);
		});

		// Touch move - update joystick position as user moves finger
		this.container.addEventListener('touchmove', (e) => {
			if (this.isJoystickActive) {
				e.preventDefault();
				this.handleTouchMove(e);
			}
		});

		// Touch end - reset joystick when user releases
		this.container.addEventListener('touchend', (e) => {
			if (this.isJoystickActive) {
				e.preventDefault();
				this.handleTouchEnd();
			}
		});

		// Touch cancel - also reset joystick
		this.container.addEventListener('touchcancel', (e) => {
			if (this.isJoystickActive) {
				e.preventDefault();
				this.handleTouchEnd();
			}
		});
	}

	private handleTouchStart(e: TouchEvent): void {
		this.isJoystickActive = true;

		// Get the touch position
		const touch = e.touches[0];

		// Position the joystick at the touch point
		this.joystickContainer.style.left = `${touch.clientX}px`;
		this.joystickContainer.style.top = `${touch.clientY}px`;

		// Show the joystick
		this.joystickContainer.style.display = 'block';

		// Store touch position for movement calculations
		this.touchStartPos = {
			x: touch.clientX,
			y: touch.clientY
		};

		// Reset handle position to center
		this.joystickHandle.style.top = '50%';
		this.joystickHandle.style.left = '50%';
		this.joystickHandle.style.transform = 'translate(-50%, -50%)';
	}

	private handleTouchMove(e: TouchEvent): void {
		if (!this.isJoystickActive) return;

		const touch = e.touches[0];
		const deltaX = touch.clientX - this.touchStartPos.x;
		const deltaY = touch.clientY - this.touchStartPos.y;

		// Calculate distance from center
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		// Normalize to max joystick distance
		const limitedDistance = Math.min(distance, this.maxJoystickDistance);
		const angle = Math.atan2(deltaY, deltaX);

		// Calculate final joystick position
		const joystickX = limitedDistance * Math.cos(angle);
		const joystickY = limitedDistance * Math.sin(angle);

		// Update joystick handle position relative to the joystick container center
		this.joystickHandle.style.transform = `translate(calc(-50% + ${joystickX}px), calc(-50% + ${joystickY}px))`;

		// Calculate movement vector (normalized between -1 and 1)
		const movementX = joystickX / this.maxJoystickDistance;
		const movementZ = joystickY / this.maxJoystickDistance;

		// Update movement vector for the game
		this.movementVector = {
			x: movementX,
			z: movementZ
		};

		// Emit movement event for Game.ts to use
		const moveEvent = new CustomEvent('touch-move', {
			detail: this.movementVector
		});
		document.dispatchEvent(moveEvent);
	}

	private handleTouchEnd(): void {
		// Hide the joystick when not in use
		this.joystickContainer.style.display = 'none';

		// Reset handle position
		this.joystickHandle.style.transform = 'translate(-50%, -50%)';

		// Reset movement vector
		this.movementVector = { x: 0, z: 0 };
		this.isJoystickActive = false;

		// Emit movement stop event
		const moveEvent = new CustomEvent('touch-move', {
			detail: this.movementVector
		});
		document.dispatchEvent(moveEvent);
	}

	// Get current movement vector from touch controls
	public getTouchMovement(): { x: number; z: number } {
		return this.movementVector;
	}

	// Helper method to check if a touch is on a UI element like the pause button
	private isTouchOnUIElement(e: TouchEvent): boolean {
		const touch = e.touches[0];

		// Get elements at the touch position
		const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);

		// Check if it's a UI element (pause button, stats panel, etc)
		if (elementAtPoint) {
			// Check if the element or its parents have higher z-index or are UI elements
			let currentElement: Element | null = elementAtPoint;
			while (currentElement && currentElement !== this.touchControls) {
				// Check various characteristics of UI elements
				const computedStyle = window.getComputedStyle(currentElement);
				const zIndex = parseInt(computedStyle.zIndex) || 0;

				// If it has a higher z-index than our touchControls, it's a UI element
				if (zIndex > 5) {
					return true;
				}

				// Also check for common UI elements
				if (
					currentElement === this.pauseButton ||
					currentElement === this.elements.statsPanel ||
					currentElement.className?.includes?.('game-ui')
				) {
					return true;
				}

				currentElement = currentElement.parentElement;
			}
		}

		return false;
	}
}
