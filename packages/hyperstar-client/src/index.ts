/**
 * Hyperstar Client
 * A lightweight reactive client library for Hyperstar apps
 *
 * Features:
 * - Reactive signals using @preact/signals-core
 * - SSE connection with automatic reconnection
 * - DOM morphing for efficient updates
 * - Event binding with modifiers
 * - Two-way input binding
 * - Visibility directives (show, class, attr, text)
 */

import { connect, disconnect, isConnected } from "./sse";
import { processTree, processElement, setupMutationObserver } from "./process";
import { dispatch, mutation, action, setSessionId, getSessionId } from "./actions";
import {
  getSignal,
  getValue,
  setValue,
  mergeSignals,
  initSignals,
  collectSignals,
  clearAll,
  batch,
} from "./signals";
import { evaluate, execute } from "./expression";
import { morph, onCleanup, parseHTML } from "./morph";

// Export everything for advanced usage
export {
  // SSE
  connect,
  disconnect,
  isConnected,

  // DOM Processing
  processTree,
  processElement,
  setupMutationObserver,

  // Actions
  dispatch,
  mutation,
  action,
  setSessionId,
  getSessionId,

  // Signals
  getSignal,
  getValue,
  setValue,
  mergeSignals,
  initSignals,
  collectSignals,
  clearAll,
  batch,

  // Expressions
  evaluate,
  execute,

  // Morphing
  morph,
  onCleanup,
  parseHTML,
};

/**
 * Initialize the Hyperstar client
 * This should be called once when the page loads
 */
export function init(): void {
  // Process existing DOM (this will execute hs-init on body, which connects to SSE)
  processTree(document);

  // Set up mutation observer for dynamic content
  setupMutationObserver();
}

/**
 * Hyperstar global object for use in expressions
 */
const Hyperstar = {
  // Core
  init,
  connect,
  disconnect,

  // Signals
  getSignal,
  getValue,
  setValue,
  mergeSignals,
  batch,

  // Actions
  dispatch,
  mutation,
  action,
  setSessionId,
  getSessionId,

  // Expressions
  evaluate,
  execute,

  // DOM
  processTree,
  processElement,
  morph,
};

// Expose globally for use in hs-on:* expressions
if (typeof window !== "undefined") {
  (window as unknown as { Hyperstar: typeof Hyperstar }).Hyperstar = Hyperstar;

  // Auto-init on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM already loaded
    init();
  }
}

export default Hyperstar;
