/**
 * Hyperstar Client - Signal Store
 * Reactive signal store using @preact/signals-core
 */
import { signal as createSignal, effect as createEffect, batch } from "@preact/signals-core";
import type { Signal as PreactSignal } from "@preact/signals-core";

// The signal store - maps signal names to preact signals
const store = new Map<string, PreactSignal<unknown>>();

// Effects cleanup registry
const effectCleanups = new Map<string, () => void>();

/**
 * Get or create a signal by name
 */
export function getSignal<T>(name: string, defaultValue?: T): PreactSignal<T> {
  if (!store.has(name)) {
    store.set(name, createSignal(defaultValue));
  }
  return store.get(name) as PreactSignal<T>;
}

/**
 * Get the current value of a signal
 */
export function getValue<T>(name: string): T | undefined {
  const sig = store.get(name);
  return sig ? (sig.value as T) : undefined;
}

/**
 * Set a signal value
 */
export function setValue<T>(name: string, value: T): void {
  const sig = getSignal<T>(name);
  sig.value = value;
}

/**
 * Merge multiple signal values (for patches from server)
 */
export function mergeSignals(values: Record<string, unknown>): void {
  batch(() => {
    for (const [name, value] of Object.entries(values)) {
      setValue(name, value);
    }
  });
}

/**
 * Initialize signals from an element's hs-signals attribute
 */
export function initSignals(values: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(values)) {
    // Only set if signal doesn't exist yet
    if (!store.has(name)) {
      getSignal(name, value);
    }
  }
}

/**
 * Create a reactive effect that runs when signals change
 */
export function createReactiveEffect(
  id: string,
  fn: () => void | (() => void)
): () => void {
  // Clean up existing effect if any
  effectCleanups.get(id)?.();

  // Create the effect
  const cleanup = createEffect(fn);

  // Store cleanup
  effectCleanups.set(id, cleanup);

  return cleanup;
}

/**
 * Collect all signals as a plain object (for sending to server)
 */
export function collectSignals(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, sig] of store) {
    result[name] = sig.value;
  }
  return result;
}

/**
 * Clear all signals and effects
 */
export function clearAll(): void {
  for (const cleanup of effectCleanups.values()) {
    cleanup();
  }
  effectCleanups.clear();
  store.clear();
}

/**
 * Export for use in expression evaluation
 */
export { batch };
