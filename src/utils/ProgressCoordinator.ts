import { nprogress } from "@mantine/nprogress";

/**
 * Coordinates progress tracking across multiple operations to ensure
 * monotonic (always increasing) progress without glitching.
 */
export class ProgressCoordinator {
  private operations: Map<string, number> = new Map();
  private weights: Map<string, number> = new Map();
  private currentProgress: number = 0;
  private updateTimeout: NodeJS.Timeout | null = null;
  private debounceMs: number;

  constructor(debounceMs: number = 16) {
    // Default to ~60fps for smooth updates
    this.debounceMs = debounceMs;
  }

  /**
   * Register an operation with a given weight.
   * @param operationId Unique identifier for the operation
   * @param weight Relative weight (e.g., 0.5 for 50% of total progress)
   */
  registerOperation(operationId: string, weight: number): void {
    this.operations.set(operationId, 0);
    this.weights.set(operationId, weight);
  }

  /**
   * Update progress for a specific operation (0-100).
   * @param operationId The operation to update
   * @param progress Progress value (0-100)
   */
  updateOperation(operationId: string, progress: number): void {
    // Ensure progress is clamped between 0-100
    const clampedProgress = Math.max(0, Math.min(100, progress));

    // Get current progress for this operation
    const currentOpProgress = this.operations.get(operationId) ?? 0;

    // Only update if progress increases (monotonic guarantee)
    if (clampedProgress > currentOpProgress) {
      this.operations.set(operationId, clampedProgress);
      this.scheduleUpdate();
    }
  }

  /**
   * Get a callback function for a specific operation that can be passed to async functions.
   * @param operationId The operation identifier
   * @returns A callback function that accepts progress (0-100)
   */
  getCallback(operationId: string): (progress: number) => void {
    return (progress: number) => this.updateOperation(operationId, progress);
  }

  /**
   * Calculate the total weighted progress across all operations.
   * @returns Total progress (0-100)
   */
  private calculateTotalProgress(): number {
    let totalProgress = 0;
    let totalWeight = 0;

    for (const [operationId, weight] of this.weights.entries()) {
      const operationProgress = this.operations.get(operationId) ?? 0;
      totalProgress += (operationProgress / 100) * weight;
      totalWeight += weight;
    }

    // Normalize to 0-100 scale
    return totalWeight > 0 ? (totalProgress / totalWeight) * 100 : 0;
  }

  /**
   * Schedule a debounced progress update to prevent rapid-fire updates.
   */
  private scheduleUpdate(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.flushUpdate();
    }, this.debounceMs);
  }

  /**
   * Immediately flush the progress update to the UI.
   */
  private flushUpdate(): void {
    const newProgress = this.calculateTotalProgress();

    // Monotonic guarantee: only update if progress increases
    if (newProgress > this.currentProgress) {
      this.currentProgress = newProgress;
      nprogress.set(this.currentProgress);
    }

    this.updateTimeout = null;
  }

  /**
   * Force an immediate update (useful for completion).
   */
  forceUpdate(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    this.flushUpdate();
  }

  /**
   * Start the progress bar.
   */
  start(): void {
    this.currentProgress = 0;
    nprogress.start();
  }

  /**
   * Complete the progress bar and reset state.
   */
  complete(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    nprogress.complete();
    this.reset();
  }

  /**
   * Reset all operation progress.
   */
  reset(): void {
    this.operations.clear();
    this.weights.clear();
    this.currentProgress = 0;
  }

  /**
   * Get the current progress value.
   */
  getCurrentProgress(): number {
    return this.currentProgress;
  }
}
