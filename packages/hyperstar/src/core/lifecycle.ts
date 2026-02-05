/**
 * Hyperstar v3 - Lifecycle Context (Simplified)
 *
 * Minimal lifecycle context for onStart hook.
 * Use app.repeat() and app.cron() for scheduled work.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Simplified lifecycle context for onStart hook.
 * Contains only store access - use app methods for scheduling.
 */
export interface LifecycleContext<S> {
  /** Current store value (snapshot at time of call) */
  readonly store: S
  /** Update the store with a function */
  readonly update: (fn: (s: S) => S) => void
  /** Get the current store value */
  readonly getStore: () => S
}

// Legacy types kept for type compatibility
export type StopFn = () => void
export type CancelFn = () => void
export type TickContext<S> = LifecycleContext<S> & { fps: number }
export type TimerHandlerContext<S> = TickContext<S>
export type TimerConfig<S> = {
  interval: number
  when?: (s: S) => boolean
  trackFps?: boolean
  handler: (ctx: TimerHandlerContext<S>) => void
}
export type ManagedTimer = { stop: () => void }

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a simplified lifecycle context for the onStart hook.
 */
export const createLifecycleContext = <S extends object>(
  getStore: () => S,
  updateStore: (fn: (s: S) => S) => void,
): { context: LifecycleContext<S>; cleanup: () => void } => {
  const context: LifecycleContext<S> = {
    store: getStore(),
    update: updateStore,
    getStore,
  }

  // Cleanup is now a no-op since we removed interval/spawn/timeout
  const cleanup = () => {
    // No-op - repeat/cron are managed by the app
  }

  return { context, cleanup }
}

// Keep createManagedTimer for backwards compatibility but mark as deprecated
/** @deprecated Use app.repeat() instead */
export const createManagedTimer = <S extends object>(
  _config: TimerConfig<S>,
  _getStore: () => S,
  _updateStore: (fn: (s: S) => S) => void,
): ManagedTimer => {
  console.warn("createManagedTimer is deprecated. Use app.repeat() instead.")
  return { stop: () => {} }
}
