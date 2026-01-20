/**
 * Hyperstar Client - Expression Evaluation
 * Safely evaluate expressions with $signal syntax
 */
import { getSignal, setValue, batch } from "./signals";
import type { Signal } from "@preact/signals-core";

// Cached compiled expression functions
const exprCache = new Map<string, Function>();

/**
 * Transform $signal syntax to signals.name access
 * $count -> signals['count'].value
 * $count.value -> signals['count'].value (not .value.value!)
 */
function transformExpression(expr: string): string {
  // Replace $word with signals['word'].value
  // But not $$, $evt, $el, $refs, or $this which are special
  // Also check if .value already follows to avoid .value.value
  return expr.replace(/\$(?!\$|evt|el|refs|this)(\w+)(\.value)?/g, (_, name, hasValue) => {
    // Always return signals['name'].value - the optional .value group captures any existing .value
    return `signals['${name}'].value`;
  });
}

/**
 * Create a signals proxy for expression evaluation
 */
function createSignalsProxy(): Record<string, Signal<unknown>> {
  return new Proxy({} as Record<string, Signal<unknown>>, {
    get(_, prop: string) {
      return getSignal(prop);
    },
    set(_, prop: string, value: unknown) {
      setValue(prop, value);
      return true;
    },
  });
}

/**
 * Compile an expression into a callable function
 */
function compileExpression(expr: string): Function {
  const cached = exprCache.get(expr);
  if (cached) return cached;

  const transformed = transformExpression(expr);

  // Create function with signals proxy and common helpers in scope
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    "signals",
    "$evt",
    "$el",
    "$refs",
    `
    "use strict";
    try {
      return ${transformed};
    } catch (e) {
      console.error('Expression error:', e, 'in:', ${JSON.stringify(expr)});
      return undefined;
    }
    `
  );

  exprCache.set(expr, fn);
  return fn;
}

/**
 * Compile a statement (can include assignments)
 */
function compileStatement(expr: string): Function {
  const cached = exprCache.get("stmt:" + expr);
  if (cached) return cached;

  const transformed = transformExpression(expr);

  // eslint-disable-next-line no-new-func
  const fn = new Function(
    "signals",
    "$evt",
    "$el",
    "$refs",
    "Hyperstar",
    `
    "use strict";
    try {
      ${transformed};
    } catch (e) {
      console.error('Statement error:', e, 'in:', ${JSON.stringify(expr)});
    }
    `
  );

  exprCache.set("stmt:" + expr, fn);
  return fn;
}

/**
 * Evaluate an expression and return the result
 */
export function evaluate(
  expr: string,
  context?: { evt?: Event; el?: Element; refs?: Record<string, Element> }
): unknown {
  const fn = compileExpression(expr);
  const signals = createSignalsProxy();
  return fn(signals, context?.evt, context?.el, context?.refs);
}

/**
 * Execute a statement (for event handlers)
 */
export function execute(
  expr: string,
  context?: { evt?: Event; el?: Element; refs?: Record<string, Element> }
): void {
  batch(() => {
    const fn = compileStatement(expr);
    const signals = createSignalsProxy();
    // Get Hyperstar from global scope for hs-init
    const Hyperstar = (window as unknown as { Hyperstar?: unknown }).Hyperstar;
    fn(signals, context?.evt, context?.el, context?.refs, Hyperstar);
  });
}

/**
 * Create a reactive expression that re-evaluates when signals change
 * Note: This needs to be called from visibility.ts which imports createReactiveEffect
 */
export function createReactiveExpression(
  expr: string,
  callback: (value: unknown) => void,
  context?: { el?: Element; refs?: Record<string, Element> }
): () => void {
  const fn = compileExpression(expr);
  const signals = createSignalsProxy();

  // Import dynamically to avoid circular dependency
  // The calling code should pass in the effect function
  const { effect } = require("@preact/signals-core");

  const dispose = effect(() => {
    const value = fn(signals, undefined, context?.el, context?.refs);
    callback(value);
  });

  return dispose;
}

/**
 * Clear the expression cache
 */
export function clearExpressionCache(): void {
  exprCache.clear();
}
