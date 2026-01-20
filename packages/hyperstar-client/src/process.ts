/**
 * Hyperstar Client - DOM Processing
 * Processes hs-* attributes on elements
 */
import { initSignals } from "./signals";
import { execute } from "./expression";
import { processEventBindings, cleanupEventBindings, invalidateRefCache } from "./events";
import { processVisibilityDirectives, cleanupVisibilityDirectives } from "./visibility";
import { processBinding, cleanupBindings } from "./binding";

// Set of processed elements to avoid double-processing
const processedElements = new WeakSet<Element>();

/**
 * Process hs-signals attribute to initialize signals
 */
function processSignalsAttr(el: Element): void {
  const signalsAttr = el.getAttribute("hs-signals");
  if (signalsAttr) {
    try {
      const signals = JSON.parse(signalsAttr);
      initSignals(signals);
    } catch (e) {
      console.error("[hyperstar] Failed to parse hs-signals:", e, signalsAttr);
    }
  }
}

/**
 * Process hs-init attribute
 */
function processInit(el: Element): void {
  const initExpr = el.getAttribute("hs-init");
  if (initExpr) {
    // Execute the init expression
    execute(initExpr, { el });
  }
}

/**
 * Process hs-ref attribute
 */
function processRef(el: Element): void {
  // hs-ref is handled during event binding by collecting refs
  // No processing needed here - refs are looked up dynamically
}

/**
 * Check if element has any hs-* attributes
 */
function hasHyperstarAttributes(el: Element): boolean {
  for (const attr of el.attributes) {
    if (attr.name.startsWith("hs-")) {
      return true;
    }
  }
  return false;
}

/**
 * Process a single element
 */
export function processElement(el: Element): void {
  if (!hasHyperstarAttributes(el)) return;
  if (processedElements.has(el)) return;

  // Mark as processed before doing anything
  // (to prevent infinite loops if processing triggers reprocessing)
  processedElements.add(el);

  // Process in order:
  // 1. Signals (must be first to set up initial values)
  processSignalsAttr(el);

  // 2. Init (runs once on element creation)
  processInit(el);

  // 3. Refs (for $refs in expressions)
  processRef(el);

  // 4. Bindings (two-way data binding)
  processBinding(el);

  // 5. Visibility directives (show, class, attr, text)
  processVisibilityDirectives(el);

  // 6. Event bindings (last, so other directives are already set up)
  processEventBindings(el);
}

/**
 * Clean up an element
 */
export function cleanupElement(el: Element): void {
  cleanupEventBindings(el);
  cleanupVisibilityDirectives(el);
  cleanupBindings(el);
  processedElements.delete(el);
}

/**
 * Clear processed state for an element and all descendants
 * Used before reprocessing after a morph
 */
export function clearProcessedState(root: Element): void {
  processedElements.delete(root);
  for (const el of root.querySelectorAll("*")) {
    processedElements.delete(el);
  }
}

/**
 * Process an element and all its descendants using a single TreeWalker pass
 * Optimization: Uses TreeWalker instead of double querySelectorAll
 */
export function processTree(root: Element | Document = document): void {
  // Use TreeWalker for a single-pass traversal of all elements
  const rootNode = root instanceof Document ? root.body : root;
  if (!rootNode) return;

  // Process the root node itself first (TreeWalker.nextNode() skips the root)
  processElement(rootNode);

  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        // Accept all elements - hasHyperstarAttributes check is fast
        // and processElement already handles the WeakSet check
        if (node instanceof Element && hasHyperstarAttributes(node)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    processElement(node as Element);
  }
}

/**
 * Set up mutation observer to process new elements
 * Optimization: Removed attributeFilter to catch dynamic attributes like hs-on:*, hs-class:*, etc.
 * Also invalidates ref cache on DOM changes.
 */
export function setupMutationObserver(): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    let hasStructuralChanges = false;

    for (const mutation of mutations) {
      // Process added nodes
      if (mutation.addedNodes.length > 0) {
        hasStructuralChanges = true;
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            processTree(node);
          }
        }
      }

      // Clean up removed nodes
      if (mutation.removedNodes.length > 0) {
        hasStructuralChanges = true;
        for (const node of mutation.removedNodes) {
          if (node instanceof Element) {
            cleanupElement(node);
            // Also clean up descendants
            for (const descendant of node.querySelectorAll("*")) {
              cleanupElement(descendant);
            }
          }
        }
      }

      // Handle attribute changes
      if (mutation.type === "attributes" && mutation.target instanceof Element) {
        const attr = mutation.attributeName;
        if (attr?.startsWith("hs-")) {
          // Reprocess the element
          processedElements.delete(mutation.target);
          processElement(mutation.target);
          // Invalidate ref cache if hs-ref changed
          if (attr === "hs-ref") {
            hasStructuralChanges = true;
          }
        }
      }
    }

    // Invalidate ref cache if DOM structure changed
    if (hasStructuralChanges) {
      invalidateRefCache();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    // Removed attributeFilter to catch dynamic attributes like hs-on:click, hs-class:active, etc.
    // The callback filters by checking if attributeName starts with "hs-"
  });

  return observer;
}
