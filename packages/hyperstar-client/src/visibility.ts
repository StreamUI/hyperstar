/**
 * Hyperstar Client - Visibility Directives
 * Handles hs-show, hs-class:*, hs-attr:*, hs-text
 */
import { evaluate, createReactiveExpression } from "./expression";

// Track effects for cleanup
const effectCleanups = new WeakMap<Element, Map<string, () => void>>();

/**
 * Get or create cleanup map for an element
 */
function getCleanups(el: Element): Map<string, () => void> {
  if (!effectCleanups.has(el)) {
    effectCleanups.set(el, new Map());
  }
  return effectCleanups.get(el)!;
}

/**
 * Register a cleanup function for an element
 */
function registerCleanup(el: Element, key: string, cleanup: () => void): void {
  const cleanups = getCleanups(el);
  // Run existing cleanup if any
  cleanups.get(key)?.();
  cleanups.set(key, cleanup);
}

/**
 * Process hs-show directive
 * Shows/hides element based on expression
 */
export function processShow(el: Element): void {
  const expr = el.getAttribute("hs-show");
  if (!expr) return;

  // Store original display value, but ignore "none" as that may be from previous effect
  const currentDisplay = (el as HTMLElement).style.display;
  const originalDisplay = currentDisplay === "none" ? "" : currentDisplay;

  const cleanup = createReactiveExpression(expr, (value) => {
    const htmlEl = el as HTMLElement;
    if (value) {
      htmlEl.style.display = originalDisplay || "";
    } else {
      htmlEl.style.display = "none";
    }
  }, { el });

  registerCleanup(el, "show", cleanup);
}

/**
 * Process hs-class:* directives
 * Toggles CSS classes based on expressions
 */
export function processClass(el: Element): void {
  for (const attr of el.attributes) {
    if (attr.name.startsWith("hs-class:")) {
      const className = attr.name.slice(9); // "hs-class:".length
      const expr = attr.value;

      const cleanup = createReactiveExpression(expr, (value) => {
        if (value) {
          el.classList.add(className);
        } else {
          el.classList.remove(className);
        }
      }, { el });

      registerCleanup(el, `class:${className}`, cleanup);
    }
  }

  // Also handle hs-class="{...}" object syntax
  const classAttr = el.getAttribute("hs-class");
  if (classAttr) {
    // This is an object expression: { 'class-name': condition, ... }
    const cleanup = createReactiveExpression(classAttr, (value) => {
      if (typeof value === "object" && value !== null) {
        for (const [cls, condition] of Object.entries(value)) {
          if (condition) {
            el.classList.add(cls);
          } else {
            el.classList.remove(cls);
          }
        }
      }
    }, { el });

    registerCleanup(el, "class", cleanup);
  }
}

/**
 * Process hs-attr:* directives
 * Sets/removes attributes based on expressions
 */
export function processAttr(el: Element): void {
  for (const attr of el.attributes) {
    if (attr.name.startsWith("hs-attr:")) {
      const attrName = attr.name.slice(8); // "hs-attr:".length
      const expr = attr.value;

      const cleanup = createReactiveExpression(expr, (value) => {
        if (value === false || value === null || value === undefined) {
          el.removeAttribute(attrName);
        } else if (value === true) {
          el.setAttribute(attrName, "");
        } else {
          el.setAttribute(attrName, String(value));
        }
      }, { el });

      registerCleanup(el, `attr:${attrName}`, cleanup);
    }
  }
}

/**
 * Process hs-text directive
 * Sets element text content based on expression
 */
export function processText(el: Element): void {
  const expr = el.getAttribute("hs-text");
  if (!expr) return;

  const cleanup = createReactiveExpression(expr, (value) => {
    el.textContent = value === null || value === undefined ? "" : String(value);
  }, { el });

  registerCleanup(el, "text", cleanup);
}

/**
 * Process hs-html directive
 * Sets element innerHTML based on expression
 */
export function processHtml(el: Element): void {
  const expr = el.getAttribute("hs-html");
  if (!expr) return;

  const cleanup = createReactiveExpression(expr, (value) => {
    el.innerHTML = value === null || value === undefined ? "" : String(value);
  }, { el });

  registerCleanup(el, "html", cleanup);
}

/**
 * Process hs-style:* directives
 * Sets inline styles based on expressions
 */
export function processStyle(el: Element): void {
  for (const attr of el.attributes) {
    if (attr.name.startsWith("hs-style:")) {
      const styleProp = attr.name.slice(9); // "hs-style:".length
      const expr = attr.value;

      const cleanup = createReactiveExpression(expr, (value) => {
        const htmlEl = el as HTMLElement;
        if (value === null || value === undefined || value === "") {
          htmlEl.style.removeProperty(styleProp);
        } else {
          htmlEl.style.setProperty(styleProp, String(value));
        }
      }, { el });

      registerCleanup(el, `style:${styleProp}`, cleanup);
    }
  }
}

/**
 * Process all visibility directives on an element
 */
export function processVisibilityDirectives(el: Element): void {
  processShow(el);
  processClass(el);
  processAttr(el);
  processText(el);
  processHtml(el);
  processStyle(el);
}

/**
 * Clean up all effects on an element
 */
export function cleanupVisibilityDirectives(el: Element): void {
  const cleanups = effectCleanups.get(el);
  if (cleanups) {
    for (const cleanup of cleanups.values()) {
      cleanup();
    }
    cleanups.clear();
    effectCleanups.delete(el);
  }
}
