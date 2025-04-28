/**
 * Interface for objects that need to clean up resources
 */
export interface IDisposable {
	/**
	 * Dispose of any resources used by this object
	 */
	dispose(): void;
}
