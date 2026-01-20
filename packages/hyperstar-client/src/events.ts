/**
 * Hyperstar Client - Event Binding
 * Handles hs-on:* event bindings with modifiers
 */
import { execute } from "./expression";

// Track registered event listeners for cleanup
const listenerRegistry = new WeakMap<Element, Map<string, () => void>>();

// Cached refs lookup for performance optimization
// Invalidated on DOM mutations by the mutation observer in process.ts
let cachedRefs: Record<string, Element> | null = null;

/**
 * Get all refs in the document (cached for performance)
 */
function getRefs(): Record<string, Element> {
  if (!cachedRefs) {
    cachedRefs = {};
    document.querySelectorAll("[hs-ref]").forEach((el) => {
      const name = el.getAttribute("hs-ref");
      if (name) cachedRefs![name] = el;
    });
  }
  return cachedRefs;
}

/**
 * Invalidate the ref cache
 * Called by the mutation observer when DOM changes
 */
export function invalidateRefCache(): void {
  cachedRefs = null;
}

/**
 * Parse event modifiers from attribute name
 * hs-on:click__debounce_300ms__prevent -> { event: 'click', modifiers: {...} }
 */
export interface EventModifiers {
  prevent?: boolean;
  stop?: boolean;
  once?: boolean;
  outside?: boolean;
  debounce?: number;
  throttle?: number;
  capture?: boolean;
  passive?: boolean;
  self?: boolean;
}

interface ParsedEvent {
  event: string;
  modifiers: EventModifiers;
}

export function parseEventAttribute(attr: string): ParsedEvent | null {
  // hs-on:click__prevent__debounce_300ms
  if (!attr.startsWith("hs-on:")) return null;

  const parts = attr.slice(6).split("__");
  const event = parts[0];
  const modifiers: EventModifiers = {};

  for (let i = 1; i < parts.length; i++) {
    const mod = parts[i];

    if (mod === "prevent") modifiers.prevent = true;
    else if (mod === "stop") modifiers.stop = true;
    else if (mod === "once") modifiers.once = true;
    else if (mod === "outside") modifiers.outside = true;
    else if (mod === "capture") modifiers.capture = true;
    else if (mod === "passive") modifiers.passive = true;
    else if (mod === "self") modifiers.self = true;
    else if (mod.startsWith("debounce")) {
      const match = mod.match(/debounce[._]?(\d+)(ms)?/);
      if (match) {
        modifiers.debounce = parseInt(match[1], 10);
      }
    } else if (mod.startsWith("throttle")) {
      const match = mod.match(/throttle[._]?(\d+)(ms)?/);
      if (match) {
        modifiers.throttle = parseInt(match[1], 10);
      }
    }
  }

  return { event, modifiers };
}

/**
 * Create a debounced function
 */
function debounce(
  fn: (evt: Event) => void,
  delay: number
): (evt: Event) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (evt: Event) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(evt), delay);
  };
}

/**
 * Create a throttled function
 */
function throttle(
  fn: (evt: Event) => void,
  delay: number
): (evt: Event) => void {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (evt: Event) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn(evt);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(evt);
      }, remaining);
    }
  };
}

/**
 * Bind an event to an element
 */
export function bindEvent(
  el: Element,
  event: string,
  expr: string,
  modifiers: EventModifiers
): () => void {
  // Create the base handler
  let handler = (evt: Event) => {
    // Handle self modifier
    if (modifiers.self && evt.target !== el) return;

    // Handle prevent/stop
    if (modifiers.prevent) evt.preventDefault();
    if (modifiers.stop) evt.stopPropagation();

    // Execute the expression
    execute(expr, { evt, el, refs: getRefs() });
  };

  // Apply debounce/throttle
  if (modifiers.debounce) {
    handler = debounce(handler, modifiers.debounce);
  } else if (modifiers.throttle) {
    handler = throttle(handler, modifiers.throttle);
  }

  // Build options
  const options: AddEventListenerOptions = {
    capture: modifiers.capture,
    passive: modifiers.passive,
    once: modifiers.once,
  };

  // Handle 'outside' modifier
  let cleanup: () => void;

  if (modifiers.outside) {
    // Listen on document for clicks outside the element
    const outsideHandler = (evt: Event) => {
      if (!el.contains(evt.target as Node)) {
        handler(evt);
      }
    };
    document.addEventListener(event, outsideHandler, options);
    cleanup = () => document.removeEventListener(event, outsideHandler, options);
  } else {
    el.addEventListener(event, handler, options);
    cleanup = () => el.removeEventListener(event, handler, options);
  }

  // Track the listener
  if (!listenerRegistry.has(el)) {
    listenerRegistry.set(el, new Map());
  }
  const listeners = listenerRegistry.get(el)!;
  const key = `${event}:${expr}`;

  // Clean up existing listener if any
  listeners.get(key)?.();
  listeners.set(key, cleanup);

  return cleanup;
}

/**
 * Process all event bindings on an element
 */
export function processEventBindings(el: Element): void {
  // Clean up existing bindings first (in case we're reprocessing after morph)
  cleanupEventBindings(el);

  for (const attr of el.attributes) {
    const parsed = parseEventAttribute(attr.name);
    if (parsed) {
      bindEvent(el, parsed.event, attr.value, parsed.modifiers);
    }
  }
}

/**
 * Clean up all event listeners on an element
 */
export function cleanupEventBindings(el: Element): void {
  const listeners = listenerRegistry.get(el);
  if (listeners) {
    for (const cleanup of listeners.values()) {
      cleanup();
    }
    listeners.clear();
    listenerRegistry.delete(el);
  }
}
