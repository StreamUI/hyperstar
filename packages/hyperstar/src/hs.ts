/**
 * Hyperstar - View Helpers (hs namespace)
 *
 * Fluent API for building reactive HTML attributes.
 * Used with the $ prop in JSX.
 *
 * @example
 * <button $={hs.action(increment)}>+1</button>
 * <div $={hs.show(isVisible).class("active", isActive)}>Content</div>
 * <input $={hs.bind("email")} />
 */
import type { ActionDescriptor, Action } from "./action/schema"
import { Expr } from "./server"
import type { SignalHandle } from "./server"

// ============================================================================
// Types
// ============================================================================

type HyperstarAttributes = Record<string, string>

/**
 * For action args, allow either:
 * - Static values (strings, numbers, etc.)
 * - Expr for client-side evaluation via hs.expr()
 * - SignalHandle for automatic conversion to $signal.value
 *
 * Signal handles auto-convert, so instead of:
 *   hs.action(add, { title: hs.expr("$title.value") })
 * You can now write:
 *   hs.action(add, { title })
 */
type ActionArgsWithExpr<T> = {
  [K in keyof T]: T[K] | Expr | SignalHandle<unknown>
}

interface EventModifiers {
  debounce?: number
  throttle?: number
  once?: boolean
  prevent?: boolean
  stop?: boolean
  outside?: boolean
  capture?: boolean
  passive?: boolean
  self?: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildModifierSuffix(mods?: EventModifiers): string {
  if (!mods) return ""
  const parts: string[] = []
  if (mods.debounce) parts.push(`debounce_${mods.debounce}ms`)
  if (mods.throttle) parts.push(`throttle_${mods.throttle}ms`)
  if (mods.once) parts.push("once")
  if (mods.prevent) parts.push("prevent")
  if (mods.stop) parts.push("stop")
  if (mods.outside) parts.push("outside")
  if (mods.capture) parts.push("capture")
  if (mods.passive) parts.push("passive")
  if (mods.self) parts.push("self")
  return parts.length > 0 ? `__${parts.join("__")}` : ""
}

function toExprString(value: Expr | boolean | string | number): string {
  if (value instanceof Expr) return value.code
  if (typeof value === "boolean") return String(value)
  if (typeof value === "number") return String(value)
  return value
}

function isExpr(value: unknown): value is Expr {
  return value instanceof Expr || (typeof value === "object" && value !== null && "code" in value)
}

/**
 * Check if a value is a signal handle (has name and expr properties).
 * Used to auto-detect signal handles in action args.
 */
function isSignalHandle(value: unknown): value is { name: string; expr: Expr } {
  return (
    value !== null &&
    typeof value === "object" &&
    "name" in value &&
    typeof (value as any).name === "string" &&
    "expr" in value
  )
}

function buildDispatchCall(actionId: string, args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) {
    return `Hyperstar.dispatch('${actionId}',{})`
  }

  // Build args object with expressions evaluated client-side
  const argParts: string[] = []
  for (const [key, value] of Object.entries(args)) {
    if (isExpr(value)) {
      // Expr objects become inline JavaScript expressions
      argParts.push(`${key}:${(value as Expr).code}`)
    } else if (isSignalHandle(value)) {
      // Signal handles automatically resolve to $name.value
      argParts.push(`${key}:$${value.name}.value`)
    } else if (typeof value === "string" && value.includes("$") && value.includes(".value")) {
      // Strings containing $signal.value patterns are treated as expressions
      argParts.push(`${key}:${value}`)
    } else {
      // Static values get JSON stringified
      argParts.push(`${key}:${JSON.stringify(value)}`)
    }
  }

  return `Hyperstar.dispatch('${actionId}',{${argParts.join(",")}})`
}

// ============================================================================
// HS Builder Class
// ============================================================================

export class HSBuilder {
  private readonly attrs: HyperstarAttributes

  constructor(initial?: HyperstarAttributes) {
    this.attrs = initial ? { ...initial } : {}
  }

  private withAttr(key: string, value: string): HSBuilder {
    return new HSBuilder({ ...this.attrs, [key]: value })
  }

  private withAttrs(extra: HyperstarAttributes): HSBuilder {
    return new HSBuilder({ ...this.attrs, ...extra })
  }

  /**
   * Bind an event to an expression or action
   */
  on(event: string, handler: Expr | string, mods?: EventModifiers): HSBuilder {
    const suffix = buildModifierSuffix(mods)
    const key = `hs-on:${event}${suffix}`
    return this.withAttr(key, toExprString(handler))
  }

  /**
   * Show/hide element based on expression
   */
  show(condition: Expr | boolean): HSBuilder {
    return this.withAttr("hs-show", toExprString(condition))
  }

  /**
   * Toggle CSS class based on condition
   */
  class(className: string, condition: Expr | boolean): HSBuilder {
    return this.withAttr(`hs-class:${className}`, toExprString(condition))
  }

  /**
   * Set attribute based on condition
   */
  attr(attrName: string, condition: Expr | boolean): HSBuilder {
    return this.withAttr(`hs-attr:${attrName}`, toExprString(condition))
  }

  /**
   * Two-way bind a signal to an input by name
   */
  bind(signalName: string | SignalHandle<unknown>): HSBuilder {
    const name = typeof signalName === "string" ? signalName : signalName.name
    return this.withAttr("hs-bind", name)
  }

  /**
   * Set text content from signal
   */
  text(signalName: string | SignalHandle<unknown>): HSBuilder {
    const name = typeof signalName === "string" ? signalName : signalName.name
    return this.withAttr("hs-text", `$${name}.value`)
  }

  /**
   * Set innerHTML based on expression
   */
  html(content: Expr | string | number | boolean): HSBuilder {
    return this.withAttr("hs-html", toExprString(content))
  }

  /**
   * Set inline style based on expression
   */
  style(prop: string, value: Expr | string | number | boolean): HSBuilder {
    return this.withAttr(`hs-style:${prop}`, toExprString(value))
  }

  /**
   * Run an init expression once on element creation
   */
  init(code: Expr | string): HSBuilder {
    return this.withAttr("hs-init", toExprString(code))
  }

  /**
   * Register an element reference for $refs lookup
   */
  ref(name: string): HSBuilder {
    return this.withAttr("hs-ref", name)
  }

  /**
   * Disable element based on condition
   */
  disabled(condition: Expr | boolean): HSBuilder {
    return this.withAttr("hs-attr:disabled", toExprString(condition))
  }

  /**
   * Trigger action on click
   * Args can include Expr values for client-side evaluation:
   * @example
   * hs.action(add, { amount: hs.expr("parseInt($amount.value) || 0") })
   */
  action<I, O, S, U>(
    action: ActionDescriptor<I, O, S, U> | Action,
    args?: ActionArgsWithExpr<Partial<I extends void ? Record<string, never> : I>>,
  ): HSBuilder {
    return this.actionOn("click", action, args)
  }

  /**
   * Trigger action on a specific event
   * @example
   * hs.actionOn("change", save, { id })
   * hs.actionOn("keyup", search, { q: query }, { debounce: 200 })
   */
  actionOn<I, O, S, U>(
    event: string,
    action: ActionDescriptor<I, O, S, U> | Action,
    args?: ActionArgsWithExpr<Partial<I extends void ? Record<string, never> : I>>,
    mods?: EventModifiers,
  ): HSBuilder {
    const suffix = buildModifierSuffix(mods)
    const key = `hs-on:${event}${suffix}`
    return this.withAttr(key, buildDispatchCall(action.id, args as Record<string, unknown>))
  }

  /**
   * Submit form to action
   */
  form<I, O, S, U>(
    action: ActionDescriptor<I, O, S, U> | Action,
    args?: ActionArgsWithExpr<Partial<I extends void ? Record<string, never> : I>>,
  ): HSBuilder {
    return this.actionOn("submit", action, args, { prevent: true })
  }

  /**
   * Toggle between two class sets based on condition
   */
  toggle(condition: Expr | boolean, trueClasses: string, falseClasses: string): HSBuilder {
    const attrs = { ...this.attrs }
    for (const cls of trueClasses.split(/\s+/).filter(Boolean)) {
      attrs[`hs-class:${cls}`] = toExprString(condition)
    }
    const negated = condition instanceof Expr ? new Expr(`!(${condition.code})`) : !condition
    for (const cls of falseClasses.split(/\s+/).filter(Boolean)) {
      attrs[`hs-class:${cls}`] = toExprString(negated)
    }
    return new HSBuilder(attrs)
  }

  /**
   * Compose multiple helpers
   */
  compose(...others: HSBuilder[]): HSBuilder {
    const merged = { ...this.attrs }
    for (const other of others) {
      Object.assign(merged, other._toAttrs())
    }
    return new HSBuilder(merged)
  }

  /**
   * Make element draggable with drag-and-drop data.
   * Sets up dragstart/dragend handlers with visual feedback.
   *
   * @param dataKey - The key to use in dataTransfer (e.g., "cardId")
   * @param dataValue - The value to store (can be Expr for dynamic values)
   *
   * @example
   * <div $={hs.drag("cardId", card.id)}>Drag me</div>
   * <div $={hs.drag("itemId", selectedItem.expr)}>Dynamic item</div>
   */
  drag(dataKey: string, dataValue: string | number | Expr): HSBuilder {
    const valueStr =
      dataValue instanceof Expr
        ? dataValue.code
        : typeof dataValue === "number"
          ? String(dataValue)
          : `'${String(dataValue).replace(/'/g, "\\'")}'`

    const attrs = { ...this.attrs }
    attrs["draggable"] = "true"
    attrs["hs-on:dragstart"] =
      `$evt.dataTransfer.setData('${dataKey}', ${valueStr}); $evt.dataTransfer.effectAllowed = 'move'; $el.style.opacity = '0.5'`
    attrs["hs-on:dragend"] = "$el.style.opacity = '1'"
    return new HSBuilder(attrs)
  }

  /**
   * Make element a drop target that dispatches an action on drop.
   * Sets up dragover/dragleave/drop handlers with visual feedback.
   *
   * @param action - The action to dispatch on drop
   * @param dataKey - The dataTransfer key to read (e.g., "cardId")
   * @param argName - The action argument name for the dropped data (defaults to dataKey)
   * @param extraArgs - Additional static or dynamic arguments to pass
   * @param highlightClasses - CSS classes to add on dragover (default: "bg-blue-100 ring-2 ring-blue-300")
   *
   * @example
   * <div $={hs.drop(moveCard, "cardId", "cardId", { targetColumnId: column.id })}>
   *   Drop here
   * </div>
   *
   * // With custom highlight classes
   * <div $={hs.drop(moveCard, "cardId", "cardId", {}, "bg-green-100 border-green-500")}>
   */
  drop<I, O, S, U>(
    action: ActionDescriptor<I, O, S, U> | Action,
    dataKey: string,
    argName?: string,
    extraArgs?: Record<string, unknown>,
    highlightClasses?: string,
  ): HSBuilder {
    const dropArgName = argName ?? dataKey
    const classes = highlightClasses ?? "bg-blue-100 ring-2 ring-blue-300"
    const classesArray = classes.split(/\s+/).filter(Boolean)
    const addClasses = classesArray.map(c => `'${c}'`).join(", ")
    const removeClasses = addClasses

    // Build the dispatch call with the dropped data merged in
    const allArgs: Record<string, unknown> = {
      ...extraArgs,
      [dropArgName]: new Expr(`$evt.dataTransfer.getData('${dataKey}')`),
    }

    const dispatchCall = buildDispatchCall(action.id, allArgs)

    const attrs = { ...this.attrs }
    attrs["hs-on:dragover"] =
      `$evt.preventDefault(); $evt.dataTransfer.dropEffect = 'move'; $el.classList.add(${addClasses})`
    attrs["hs-on:dragleave"] = `$el.classList.remove(${removeClasses})`
    attrs["hs-on:drop"] = `$evt.preventDefault(); $el.classList.remove(${removeClasses}); ${dispatchCall}`
    return new HSBuilder(attrs)
  }

  /**
   * Build final attributes
   */
  build(): HyperstarAttributes {
    return { ...this.attrs }
  }

  /**
   * Internal method for JSX runtime to extract attributes
   * @internal
   */
  _toAttrs(): HyperstarAttributes {
    return this.build()
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * The `hs` namespace for building reactive attributes
 *
 * Returns HSBuilder instances that can be:
 * 1. Used with the $ prop: <button $={hs.action(increment)}>+1</button>
 * 2. Spread manually: <button {...hs.action(increment).build()}>+1</button>
 * 3. Chained: <div $={hs.show(isVisible).class("active", isActive)}>
 *
 * @example
 * <button $={hs.action(increment)}>+1</button>
 * <div $={hs.show(count.gt(0))}>Positive!</div>
 * <input $={hs.bind("text")} />
 */
export const hs = {
  /**
   * Create a client-side expression for use in action args
   * @example
   * hs.action(add, { amount: hs.expr("parseInt($amount.value) || 0") })
   */
  expr(code: string): Expr {
    return new Expr(code)
  },

  /**
   * Compose multiple expressions into a single statement
   * @example
   * hs.on("click", hs.seq(count.set(0), filter.set("all")))
   */
  seq(...expressions: Array<Expr | string>): Expr {
    const parts = expressions
      .map((expr) => (expr instanceof Expr ? expr.code : expr))
      .filter((part) => part && String(part).trim().length > 0)
    return new Expr(parts.join("; "))
  },

  /**
   * Trigger action on click.
   * Args can include signal handles (auto-convert to $signal.value) or hs.expr().
   *
   * @example
   * hs.action(addTask, { title: titleSignal })  // signal handle
   * hs.action(addTask, { title: hs.expr("$title.value.trim()") })  // custom expression
   */
  action<I, O, S, U>(
    action: ActionDescriptor<I, O, S, U> | Action,
    args?: ActionArgsWithExpr<Partial<I extends void ? Record<string, never> : I>>,
  ): HSBuilder {
    return new HSBuilder().action(action, args)
  },

  /**
   * Trigger action on a specific event.
   * Supports event modifiers like debounce, prevent, outside, etc.
   *
   * @example
   * hs.actionOn("change", save, { id })
   * hs.actionOn("keyup", search, { q: query }, { debounce: 200 })
   */
  actionOn<I, O, S, U>(
    event: string,
    action: ActionDescriptor<I, O, S, U> | Action,
    args?: ActionArgsWithExpr<Partial<I extends void ? Record<string, never> : I>>,
    mods?: EventModifiers,
  ): HSBuilder {
    return new HSBuilder().actionOn(event, action, args, mods)
  },

  /**
   * Submit form to action.
   * Args can include signal handles (auto-convert to $signal.value) or hs.expr().
   *
   * @example
   * hs.form(addTask, { title, description })  // signal handles
   * hs.form(addTask, { title: hs.expr("$title.value.trim()") })  // custom expression
   */
  form<I, O, S, U>(
    action: ActionDescriptor<I, O, S, U> | Action,
    args?: ActionArgsWithExpr<Partial<I extends void ? Record<string, never> : I>>,
  ): HSBuilder {
    return new HSBuilder().form(action, args)
  },

  /**
   * Bind event to expression
   */
  on(event: string, handler: Expr | string, mods?: EventModifiers): HSBuilder {
    return new HSBuilder().on(event, handler, mods)
  },

  /**
   * Show element based on condition
   */
  show(condition: Expr | boolean): HSBuilder {
    return new HSBuilder().show(condition)
  },

  /**
   * Toggle class based on condition
   */
  class(className: string, condition: Expr | boolean): HSBuilder {
    return new HSBuilder().class(className, condition)
  },

  /**
   * Set attribute based on condition
   */
  attr(attrName: string, condition: Expr | boolean): HSBuilder {
    return new HSBuilder().attr(attrName, condition)
  },

  /**
   * Bind signal to input
   */
  bind(signalName: string | SignalHandle<unknown>): HSBuilder {
    return new HSBuilder().bind(signalName)
  },

  /**
   * Set text from signal
   */
  text(signalName: string | SignalHandle<unknown>): HSBuilder {
    return new HSBuilder().text(signalName)
  },

  /**
   * Set innerHTML based on expression
   */
  html(content: Expr | string | number | boolean): HSBuilder {
    return new HSBuilder().html(content)
  },

  /**
   * Set inline style based on expression
   */
  style(prop: string, value: Expr | string | number | boolean): HSBuilder {
    return new HSBuilder().style(prop, value)
  },

  /**
   * Run an init expression once on element creation
   */
  init(code: Expr | string): HSBuilder {
    return new HSBuilder().init(code)
  },

  /**
   * Register an element reference for $refs lookup
   */
  ref(name: string): HSBuilder {
    return new HSBuilder().ref(name)
  },

  /**
   * Disable based on condition
   */
  disabled(condition: Expr | boolean): HSBuilder {
    return new HSBuilder().disabled(condition)
  },

  /**
   * Toggle between two class sets
   */
  toggle(condition: Expr | boolean, trueClasses: string, falseClasses: string): HSBuilder {
    return new HSBuilder().toggle(condition, trueClasses, falseClasses)
  },

  /**
   * Compose multiple builders
   */
  compose(...builders: HSBuilder[]): HSBuilder {
    const merged: HyperstarAttributes = {}
    for (const b of builders) {
      Object.assign(merged, b.build())
    }
    return new HSBuilder(merged)
  },

  /**
   * Start a builder chain for complex compositions
   */
  builder(): HSBuilder {
    return new HSBuilder()
  },

  /**
   * Make element draggable with drag-and-drop data.
   * Sets up dragstart/dragend handlers with visual feedback.
   *
   * @param dataKey - The key to use in dataTransfer (e.g., "cardId")
   * @param dataValue - The value to store (can be Expr for dynamic values)
   *
   * @example
   * <div $={hs.drag("cardId", card.id)}>Drag me</div>
   */
  drag(dataKey: string, dataValue: string | number | Expr): HSBuilder {
    return new HSBuilder().drag(dataKey, dataValue)
  },

  /**
   * Make element a drop target that dispatches an action on drop.
   * Sets up dragover/dragleave/drop handlers with visual feedback.
   *
   * @param action - The action to dispatch on drop
   * @param dataKey - The dataTransfer key to read (e.g., "cardId")
   * @param argName - The action argument name for the dropped data (defaults to dataKey)
   * @param extraArgs - Additional static or dynamic arguments to pass
   * @param highlightClasses - CSS classes to add on dragover (default: "bg-blue-100 ring-2 ring-blue-300")
   *
   * @example
   * <div $={hs.drop(moveCard, "cardId", "cardId", { targetColumnId: column.id })}>
   *   Drop here
   * </div>
   */
  drop<I, O, S, U>(
    action: ActionDescriptor<I, O, S, U> | Action,
    dataKey: string,
    argName?: string,
    extraArgs?: Record<string, unknown>,
    highlightClasses?: string,
  ): HSBuilder {
    return new HSBuilder().drop(action, dataKey, argName, extraArgs, highlightClasses)
  },
}
