// Import Stats type from three/examples
interface Stats {
	dom: HTMLElement;
	showPanel(panel: number): void;
	begin(): void;
	end(): void;
}

export enum LogLevel {
	ERROR = 0,
	WARN = 1,
	INFO = 2,
	DEBUG = 3
}

/**
 * Debug utility for performance monitoring and logging
 * Usage: import { Debug } from './utils/Debug';
 */
export class Debug {
	private static instance: Debug;
	private stats: Stats | null = null;
	private memoryStats: Stats | null = null;
	private container: HTMLElement | null = null;
	private enabled: boolean = false;
	private consoleLogLevel: LogLevel = LogLevel.INFO;
	private objectCounts: Record<string, number> = {};
	private domDebugPanel: HTMLElement | null = null;
	private startTime: number = performance.now();
	private frames: number = 0;
	private lastFpsUpdate: number = 0;
	private lastFrameTime: number = 0;
	private gcWarningCount: number = 0;
	private gcWarningThreshold: number = 20; // memory objects before warning

	private constructor() {}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(): Debug {
		if (!Debug.instance) {
			Debug.instance = new Debug();
		}
		return Debug.instance;
	}

	/**
	 * Initialize the debug tools
	 */
	public init(
		container: HTMLElement,
		enabled: boolean = true,
		logLevel: LogLevel = LogLevel.INFO
	): void {
		this.container = container;
		this.enabled = enabled;
		this.consoleLogLevel = logLevel;
		this.startTime = performance.now();

		if (!this.enabled) return;

		// Import Stats dynamically only if debugging is enabled
		import('three/addons/libs/stats.module.js').then((StatsModule) => {
			const Stats = StatsModule.default;

			// Initialize FPS counter
			this.stats = new Stats();
			this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
			this.stats.dom.style.cssText = 'position:absolute;top:0;left:0;z-index:1000;';
			if (this.container) {
				this.container.appendChild(this.stats.dom);
			}

			// Initialize memory monitor
			this.memoryStats = new Stats();
			this.memoryStats.showPanel(2); // memory
			this.memoryStats.dom.style.cssText = 'position:absolute;top:0;left:80px;z-index:1000;';
			if (this.container) {
				this.container.appendChild(this.memoryStats.dom);
			}

			// Create DOM debug panel
			this.createDomDebugPanel();
		});
	}

	/**
	 * Start performance measurement for a frame
	 */
	public startFrame(): void {
		if (!this.enabled) return;
		this.lastFrameTime = performance.now();
		this.stats?.begin();
		this.memoryStats?.begin();
	}

	/**
	 * End performance measurement for a frame
	 */
	public endFrame(): void {
		if (!this.enabled) return;

		this.frames++;
		const now = performance.now();
		const frameTime = now - this.lastFrameTime;

		// Update FPS counter every 500ms
		if (now - this.lastFpsUpdate > 500) {
			this.updateDebugInfo(frameTime);
			this.lastFpsUpdate = now;
		}

		this.stats?.end();
		this.memoryStats?.end();
	}

	/**
	 * Track object creation for memory management
	 */
	public trackObject(type: string): void {
		if (!this.enabled) return;

		if (!this.objectCounts[type]) {
			this.objectCounts[type] = 0;
		}
		this.objectCounts[type]++;

		// Check if we should warn about potential memory leaks
		if (this.objectCounts[type] > this.gcWarningThreshold) {
			this.gcWarningCount++;
			if (this.gcWarningCount % 10 === 0) {
				// Only warn every 10 occurrences to avoid spam
				this.warn(`Potential memory leak: ${this.objectCounts[type]} ${type} objects created`);
			}
		}
	}

	/**
	 * Track object disposal for memory management
	 */
	public untrackObject(type: string): void {
		if (!this.enabled || !this.objectCounts[type]) return;

		this.objectCounts[type]--;
	}

	/**
	 * Log an error message
	 */
	public error(message: string, ...args: unknown[]): void {
		if (this.consoleLogLevel >= LogLevel.ERROR) {
			console.error(`[ERROR] ${message}`, ...args);
		}
	}

	/**
	 * Log a warning message
	 */
	public warn(message: string, ...args: unknown[]): void {
		if (this.consoleLogLevel >= LogLevel.WARN) {
			console.warn(`[WARN] ${message}`, ...args);
		}
	}

	/**
	 * Log an info message
	 */
	public info(message: string, ...args: unknown[]): void {
		if (this.consoleLogLevel >= LogLevel.INFO) {
			console.info(`[INFO] ${message}`, ...args);
		}
	}

	/**
	 * Log a debug message
	 */
	public debug(message: string, ...args: unknown[]): void {
		if (this.consoleLogLevel >= LogLevel.DEBUG) {
			console.debug(`[DEBUG] ${message}`, ...args);
		}
	}

	/**
	 * Create an on-screen debug panel
	 */
	private createDomDebugPanel(): void {
		if (!this.container) return;

		this.domDebugPanel = document.createElement('div');
		this.domDebugPanel.style.cssText =
			'position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);color:white;padding:10px;font-family:monospace;font-size:12px;width:250px;z-index:1000;border-radius:4px;';
		this.container.appendChild(this.domDebugPanel);

		this.updateDebugInfo(0);
	}

	/**
	 * Update the debug information displayed on screen
	 */
	private updateDebugInfo(frameTime: number): void {
		if (!this.domDebugPanel) return;

		const runtime = ((performance.now() - this.startTime) / 1000).toFixed(1);
		const fps = Math.round(this.frames / (parseFloat(runtime) || 1));

		let objectCountText = '';
		for (const [type, count] of Object.entries(this.objectCounts)) {
			objectCountText += `${type}: ${count}<br>`;
		}

		this.domDebugPanel.innerHTML = `
            <div style="font-weight:bold;margin-bottom:5px;">GAME DEBUG</div>
            Runtime: ${runtime}s<br>
            Avg FPS: ${fps}<br>
            Frame Time: ${frameTime.toFixed(2)}ms<br>
            <div style="margin-top:5px;border-top:1px solid #666;padding-top:5px;">
                <b>Object Counts:</b><br>
                ${objectCountText}
            </div>
        `;
	}

	/**
	 * Clean up resources when debug tools are no longer needed
	 */
	public cleanup(): void {
		if (!this.enabled) return;

		if (this.stats && this.stats.dom && this.stats.dom.parentElement) {
			this.stats.dom.parentElement.removeChild(this.stats.dom);
		}

		if (this.memoryStats && this.memoryStats.dom && this.memoryStats.dom.parentElement) {
			this.memoryStats.dom.parentElement.removeChild(this.memoryStats.dom);
		}

		if (this.domDebugPanel && this.domDebugPanel.parentElement) {
			this.domDebugPanel.parentElement.removeChild(this.domDebugPanel);
		}

		this.objectCounts = {};
	}
}
