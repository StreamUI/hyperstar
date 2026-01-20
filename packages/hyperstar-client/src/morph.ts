/**
 * Hyperstar Client - DOM Morphing
 * Wrapper around idiomorph for intelligent DOM diffing
 *
 * Idiomorph provides the "id-set algorithm" which builds a set of all
 * descendant IDs for each element, enabling better structural matching
 * when parent elements don't have IDs.
 */
import { Idiomorph } from "idiomorph";

type MorphMode = "outer" | "inner";

// Track elements that need cleanup before removal
const cleanupCallbacks = new WeakMap<Element, (() => void)[]>();

/**
 * Register a cleanup callback for an element
 * Called when the element is removed during morphing
 */
export function onCleanup(el: Element, callback: () => void): void {
  const callbacks = cleanupCallbacks.get(el) || [];
  callbacks.push(callback);
  cleanupCallbacks.set(el, callbacks);
}

/**
 * Run all cleanup callbacks for an element and its descendants
 */
function runCleanups(el: Element): void {
  // Run callbacks for this element
  const callbacks = cleanupCallbacks.get(el);
  if (callbacks) {
    for (const cb of callbacks) {
      try {
        cb();
      } catch (e) {
        console.error("Cleanup callback error:", e);
      }
    }
    cleanupCallbacks.delete(el);
  }

  // Run callbacks for descendants
  for (const child of el.querySelectorAll("*")) {
    const childCallbacks = cleanupCallbacks.get(child);
    if (childCallbacks) {
      for (const cb of childCallbacks) {
        try {
          cb();
        } catch (e) {
          console.error("Cleanup callback error:", e);
        }
      }
      cleanupCallbacks.delete(child);
    }
  }
}

/**
 * Morph an element to match new HTML content
 *
 * Uses idiomorph for intelligent DOM diffing with:
 * - ID-based matching across the tree
 * - Input value preservation (ignoreActiveValue)
 * - Proper cleanup of removed elements
 *
 * @param target The existing element to morph
 * @param newContent The new HTML string or element to morph to
 * @param mode "outer" replaces the element, "inner" replaces children only
 */
export function morph(
  target: Element,
  newContent: string | Element,
  mode: MorphMode = "outer"
): void {
  // Note: restoreFocus exists in idiomorph but TypeScript types are incomplete
  Idiomorph.morph(target, newContent, {
    morphStyle: mode === "outer" ? "outerHTML" : "innerHTML",
    ignoreActiveValue: true, // Don't clobber user input in focused fields
    restoreFocus: true, // Restore focus/selection after morph for better UX
    callbacks: {
      beforeNodeRemoved(node: Node): boolean {
        // Run cleanup callbacks for removed elements
        if (node instanceof Element) {
          runCleanups(node);
        }
        return true; // Allow the removal
      },
    },
  } as Parameters<typeof Idiomorph.morph>[2]);
}

/**
 * Parse HTML string into an element
 */
export function parseHTML(html: string): Element | null {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}
