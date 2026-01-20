/**
 * Hyperstar Client - Two-Way Binding
 * Handles hs-bind:* for input elements
 */
import { getSignal, setValue } from "./signals";
import { createReactiveEffect } from "./signals";

// Track cleanup functions for bindings
const bindingCleanups = new WeakMap<Element, Map<string, () => void>>();

/**
 * Get or create cleanup map for an element
 */
function getCleanups(el: Element): Map<string, () => void> {
  if (!bindingCleanups.has(el)) {
    bindingCleanups.set(el, new Map());
  }
  return bindingCleanups.get(el)!;
}

/**
 * Determine the input event to listen for
 */
function getInputEvent(el: Element): string {
  if (el instanceof HTMLSelectElement) {
    return "change";
  }
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    if (type === "checkbox" || type === "radio" || type === "range") {
      return "change";
    }
  }
  return "input";
}

/**
 * Get the current value from an input element
 */
function getInputValue(el: Element): unknown {
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    if (type === "checkbox") {
      return el.checked;
    }
    if (type === "radio") {
      return el.checked ? el.value : undefined;
    }
    if (type === "number" || type === "range") {
      return el.valueAsNumber;
    }
    return el.value;
  }
  if (el instanceof HTMLTextAreaElement) {
    return el.value;
  }
  if (el instanceof HTMLSelectElement) {
    if (el.multiple) {
      return Array.from(el.selectedOptions).map((opt) => opt.value);
    }
    return el.value;
  }
  // Contenteditable
  if (el.hasAttribute("contenteditable")) {
    return el.innerHTML;
  }
  return (el as HTMLElement).innerText;
}

/**
 * Set the value of an input element
 */
function setInputValue(el: Element, value: unknown): void {
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    if (type === "checkbox") {
      el.checked = Boolean(value);
      return;
    }
    if (type === "radio") {
      el.checked = el.value === value;
      return;
    }
    el.value = value == null ? "" : String(value);
    return;
  }
  if (el instanceof HTMLTextAreaElement) {
    el.value = value == null ? "" : String(value);
    return;
  }
  if (el instanceof HTMLSelectElement) {
    if (el.multiple && Array.isArray(value)) {
      for (const opt of el.options) {
        opt.selected = value.includes(opt.value);
      }
    } else {
      el.value = value == null ? "" : String(value);
    }
    return;
  }
  // Contenteditable
  if (el.hasAttribute("contenteditable")) {
    el.innerHTML = value == null ? "" : String(value);
    return;
  }
  (el as HTMLElement).innerText = value == null ? "" : String(value);
}

/**
 * Create a binding for an element and signal
 */
function createBinding(el: Element, signalName: string): void {
  // Get or create the signal
  const signal = getSignal(signalName);

  // Listen for input changes
  const event = getInputEvent(el);
  const handleInput = () => {
    const value = getInputValue(el);
    if (value !== undefined) {
      setValue(signalName, value);
    }
  };

  el.addEventListener(event, handleInput);

  // Create effect to sync signal -> input
  const effectId = `bind_${signalName}_${Math.random().toString(36).slice(2)}`;
  const cleanupEffect = createReactiveEffect(effectId, () => {
    const value = signal.value;
    const currentValue = getInputValue(el);
    if (value !== currentValue) {
      setInputValue(el, value);
    }
  });

  // Store cleanup
  const cleanups = getCleanups(el);
  const cleanup = () => {
    el.removeEventListener(event, handleInput);
    cleanupEffect();
  };
  cleanups.get(`bind:${signalName}`)?.();
  cleanups.set(`bind:${signalName}`, cleanup);
}

/**
 * Process hs-bind directive
 * Supports multiple formats:
 * - hs-bind="$signalName" (server format with $ prefix)
 * - hs-bind="signalName" (plain signal name)
 * - hs-bind:signalName (colon format)
 * - hs-bind (no value, uses name attribute)
 */
export function processBinding(el: Element): void {
  const bindValue = el.getAttribute("hs-bind");

  // Handle hs-bind="$signalName" or hs-bind="signalName" format
  if (bindValue) {
    // Remove $ prefix if present
    const signalName = bindValue.startsWith("$") ? bindValue.slice(1) : bindValue;
    createBinding(el, signalName);
    return; // Don't process other formats
  }

  // Handle hs-bind:signalName format
  for (const attr of el.attributes) {
    if (attr.name.startsWith("hs-bind:")) {
      const signalName = attr.name.slice(8); // "hs-bind:".length
      createBinding(el, signalName);
    }
  }

  // Handle hs-bind without value (uses name attribute)
  if (el.hasAttribute("hs-bind") && !bindValue) {
    const name = el.getAttribute("name");
    if (name) {
      createBinding(el, name);
    }
  }
}

/**
 * Clean up bindings on an element
 */
export function cleanupBindings(el: Element): void {
  const cleanups = bindingCleanups.get(el);
  if (cleanups) {
    for (const cleanup of cleanups.values()) {
      cleanup();
    }
    cleanups.clear();
    bindingCleanups.delete(el);
  }
}
