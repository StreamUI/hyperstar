/**
 * Hyperstar v3 - UI Builder API
 *
 * Ergonomic API for constructing UINode trees.
 * Provides a fluent interface while maintaining full type safety.
 */
import {
  UINode,
  AttrValue,
  EventHandler,
  Expression,
  expr,
  signal,
  normalizeArgValue,
  type ArgValue,
} from "./nodes"
import type { SignalAccessor, BooleanSignalAccessor } from "../signals/protocol"

// ============================================================================
// Class Composition Utility
// ============================================================================

/**
 * Compose class names, filtering out falsy values.
 * Inspired by clsx/classnames.
 *
 * @example
 * cx("min-h-screen", isDark && "bg-gray-900", !isDark && "bg-white")
 * // => "min-h-screen bg-gray-900" (when isDark is true)
 */
export const cx = (...classes: (string | false | null | undefined)[]): string =>
  classes.filter(Boolean).join(" ")

// ============================================================================
// Types for Builder
// ============================================================================

type Children = UINode | string | number | boolean | null | undefined | Children[]

type ElementAttrs = Record<string, string | boolean | Expression>
type ElementEvents = Record<string, EventHandler | string>

interface ElementConfig {
  readonly attrs?: ElementAttrs
  readonly events?: ElementEvents
  readonly children?: Children
}

// ============================================================================
// Child Normalization
// ============================================================================

const normalizeChild = (child: Children): UINode[] => {
  if (child === null || child === undefined || child === false) {
    return []
  }
  if (child === true) {
    return []
  }
  if (typeof child === "string") {
    return [UINode.Text({ content: child })]
  }
  if (typeof child === "number") {
    return [UINode.Text({ content: String(child) })]
  }
  if (Array.isArray(child)) {
    return child.flatMap(normalizeChild)
  }
  // Validate that it's actually a UINode (has _tag property)
  if (typeof child === "object" && "_tag" in child) {
    return [child as UINode]
  }
  // Empty objects or objects without _tag are ignored (common mistake: UI.li({}, "text"))
  return []
}

// ============================================================================
// Attribute Normalization
// ============================================================================

const normalizeAttr = (value: string | boolean | Expression): AttrValue => {
  if (typeof value === "boolean") {
    return AttrValue.Boolean({ value })
  }
  if (typeof value === "string") {
    return AttrValue.Static({ value })
  }
  return AttrValue.Dynamic({ expr: value })
}

const normalizeAttrs = (
  attrs: ElementAttrs | undefined,
): Record<string, AttrValue> => {
  if (!attrs) return {}
  const result: Record<string, AttrValue> = {}
  for (const [key, value] of Object.entries(attrs)) {
    result[key] = normalizeAttr(value)
  }
  return result
}

// ============================================================================
// Event Normalization
// ============================================================================

const normalizeEvent = (handler: EventHandler | string): EventHandler => {
  if (typeof handler === "string") {
    return EventHandler.Script({ code: handler })
  }
  return handler
}

const normalizeEvents = (
  events: ElementEvents | undefined,
): Record<string, EventHandler> => {
  if (!events) return {}
  const result: Record<string, EventHandler> = {}
  for (const [key, value] of Object.entries(events)) {
    result[key] = normalizeEvent(value)
  }
  return result
}

// ============================================================================
// Element Factory
// ============================================================================

/**
 * Check if value is an ElementConfig object
 */
const isElementConfig = (value: unknown): value is ElementConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  // Check if it's a UINode (has _tag)
  if ("_tag" in value) {
    return false
  }
  // Check if it has config-like properties OR is an empty object (common pattern: UI.li({}, "text"))
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
  return keys.length === 0 || "attrs" in obj || "events" in obj || "children" in obj
}

const createElement = (
  tag: string,
  configOrChild?: ElementConfig | Children,
  ...restChildren: Children[]
): UINode => {
  let attrs: ElementAttrs | undefined
  let events: ElementEvents | undefined
  let allChildren: Children[]

  if (isElementConfig(configOrChild)) {
    // First argument is config object
    attrs = configOrChild.attrs
    events = configOrChild.events
    // Children from config.children and rest arguments
    allChildren = configOrChild.children
      ? [configOrChild.children, ...restChildren]
      : restChildren
  } else {
    // First argument is a child
    allChildren = configOrChild !== undefined
      ? [configOrChild, ...restChildren]
      : restChildren
  }

  return UINode.Element({
    tag,
    attrs: normalizeAttrs(attrs),
    events: normalizeEvents(events),
    children: allChildren.flatMap(normalizeChild),
  })
}

// ============================================================================
// UI Namespace - Main API
// ============================================================================

/**
 * UI builder namespace providing typed element constructors
 */
export const UI = {
  // Core constructors
  text: (content: string): UINode => UINode.Text({ content }),
  raw: (html: string): UINode => UINode.Raw({ html }),
  empty: (): UINode => UINode.Empty({}),

  fragment: (...children: Children[]): UINode =>
    UINode.Fragment({ children: children.flatMap(normalizeChild) }),

  // Conditional rendering
  when: (condition: Expression | boolean, then: UINode, otherwise?: UINode): UINode =>
    UINode.Conditional({
      when: typeof condition === "boolean" ? expr(String(condition)) : condition,
      then,
      else: otherwise ?? UINode.Empty({}),
    }),

  // Show/hide (convenience for when)
  show: (condition: Expression | boolean, content: UINode): UINode =>
    UI.when(condition, content, UINode.Empty({})),

  hide: (condition: Expression | boolean, content: UINode): UINode =>
    UI.when(condition, UINode.Empty({}), content),

  // Value-based conditional rendering
  maybe: <T>(
    value: T | null | undefined | false,
    render: (v: T) => UINode,
  ): UINode => (value ? render(value) : UINode.Empty({})),

  // List rendering
  each: <T>(
    items: readonly T[],
    keyFn: (item: T, index: number) => string,
    renderFn: (item: T, index: number) => UINode,
  ): UINode =>
    UINode.Each({
      items,
      keyFn: keyFn as (item: unknown, index: number) => string,
      renderFn: renderFn as (item: unknown, index: number) => UINode,
    }),

  // Slots for composition
  slot: (name: string, fallback?: UINode): UINode =>
    UINode.Slot({ name, fallback: fallback ?? null }),

  // Generic element
  el: createElement,

  // ========================================================================
  // Common HTML Elements
  // ========================================================================

  // Document structure
  div: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("div", config, ...children),
  span: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("span", config, ...children),
  p: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("p", config, ...children),
  section: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("section", config, ...children),
  article: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("article", config, ...children),
  aside: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("aside", config, ...children),
  header: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("header", config, ...children),
  footer: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("footer", config, ...children),
  main: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("main", config, ...children),
  nav: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("nav", config, ...children),

  // Headings
  h1: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("h1", config, ...children),
  h2: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("h2", config, ...children),
  h3: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("h3", config, ...children),
  h4: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("h4", config, ...children),
  h5: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("h5", config, ...children),
  h6: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("h6", config, ...children),

  // Lists
  ul: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("ul", config, ...children),
  ol: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("ol", config, ...children),
  li: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("li", config, ...children),

  // Forms
  form: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("form", config, ...children),
  input: (config?: ElementConfig) =>
    createElement("input", config),
  button: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("button", config, ...children),
  textarea: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("textarea", config, ...children),
  select: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("select", config, ...children),
  option: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("option", config, ...children),
  label: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("label", config, ...children),
  fieldset: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("fieldset", config, ...children),
  legend: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("legend", config, ...children),

  // Media
  img: (config?: ElementConfig) => createElement("img", config),
  video: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("video", config, ...children),
  audio: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("audio", config, ...children),
  source: (config?: ElementConfig) => createElement("source", config),

  // Links
  a: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("a", config, ...children),

  // Tables
  table: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("table", config, ...children),
  thead: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("thead", config, ...children),
  tbody: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("tbody", config, ...children),
  tfoot: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("tfoot", config, ...children),
  tr: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("tr", config, ...children),
  th: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("th", config, ...children),
  td: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("td", config, ...children),

  // Misc
  hr: (config?: ElementConfig) => createElement("hr", config),
  br: () => createElement("br"),
  pre: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("pre", config, ...children),
  code: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("code", config, ...children),
  blockquote: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("blockquote", config, ...children),
  strong: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("strong", config, ...children),
  em: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("em", config, ...children),
  small: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("small", config, ...children),

  // SVG (basic)
  svg: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("svg", config, ...children),
  path: (config?: ElementConfig) => createElement("path", config),
  circle: (config?: ElementConfig) => createElement("circle", config),
  rect: (config?: ElementConfig) => createElement("rect", config),
  line: (config?: ElementConfig) => createElement("line", config),
  g: (config?: ElementConfig | Children, ...children: Children[]) =>
    createElement("g", config, ...children),
}

// ============================================================================
// Event Handler Helpers
// ============================================================================

/**
 * Normalize args - accept both static values and Expressions
 */
const normalizeArgs = (args: Record<string, unknown>): Record<string, ArgValue> => {
  const result: Record<string, ArgValue> = {}
  for (const [key, value] of Object.entries(args)) {
    result[key] = normalizeArgValue(value)
  }
  return result
}

/**
 * Type for any action-like object (has an id property)
 */
type AnyAction = { readonly id: string }

export const on = {
  /**
   * Dispatch an action on event.
   * Accepts either an action object directly or a string action ID.
   * Args can be static values (JSON-serializable) or Expressions (evaluated at runtime).
   *
   * @example
   * // Pass action object directly (recommended - type-safe, refactoring friendly)
   * on.action(start)
   * on.action(setCount, { count: 5 })
   *
   * // Pass action ID string (backwards compatible)
   * on.action("increment", { amount: 1 })
   *
   * // Dynamic args with signal values
   * on.action(add, { amount: $.parseInt($.signal("amount"), $.num(0)) })
   */
  action: (
    actionOrId: string | AnyAction,
    args: Record<string, unknown> = {},
    mode: "m" | "a" = "m",
  ): EventHandler => {
    const actionId = typeof actionOrId === "string" ? actionOrId : actionOrId.id
    return EventHandler.Action({ actionId, args: normalizeArgs(args), mode })
  },

  /**
   * Execute inline script
   */
  script: (code: string): EventHandler => EventHandler.Script({ code }),

  /**
   * Update a signal
   */
  signal: (name: string, value: Expression | string): EventHandler =>
    EventHandler.Signal({
      name,
      expr: typeof value === "string" ? expr(value) : value,
    }),

  /**
   * Sequence multiple handlers
   */
  seq: (...handlers: EventHandler[]): EventHandler =>
    EventHandler.Sequence({ handlers }),

  /**
   * Prevent default and stop propagation
   */
  prevent: (handler: EventHandler): EventHandler =>
    on.seq(on.script("event.preventDefault(); event.stopPropagation()"), handler),
}

// ============================================================================
// Expression Helpers
// ============================================================================

export const $ = {
  /**
   * Reference a signal by name
   */
  signal,

  /**
   * Literal JavaScript expression
   */
  expr,

  // ==========================================================================
  // Boolean Operations
  // ==========================================================================

  /**
   * Boolean AND
   */
  and: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "&&", right }),

  /**
   * Boolean OR
   */
  or: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "||", right }),

  /**
   * Boolean NOT
   */
  not: (e: Expression): Expression => Expression.Unary({ op: "!", expr: e }),

  // ==========================================================================
  // Comparison Operations
  // ==========================================================================

  /**
   * Equality check
   */
  eq: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "===", right }),

  /**
   * Inequality check
   */
  neq: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "!==", right }),

  /**
   * Greater than
   */
  gt: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: ">", right }),

  /**
   * Greater than or equal
   */
  gte: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: ">=", right }),

  /**
   * Less than
   */
  lt: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "<", right }),

  /**
   * Less than or equal
   */
  lte: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "<=", right }),

  // ==========================================================================
  // Arithmetic Operations
  // ==========================================================================

  /**
   * Addition
   */
  add: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "+", right }),

  /**
   * Subtraction
   */
  sub: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "-", right }),

  /**
   * Multiplication
   */
  mul: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "*", right }),

  /**
   * Division
   */
  div: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "/", right }),

  /**
   * Nullish coalescing (x ?? y)
   */
  coalesce: (left: Expression, right: Expression): Expression =>
    Expression.Binary({ left, op: "??", right }),

  // ==========================================================================
  // Control Flow
  // ==========================================================================

  /**
   * Ternary expression (condition ? then : otherwise)
   */
  if: (condition: Expression, then: Expression, otherwise: Expression): Expression =>
    Expression.Ternary({ condition, then, else: otherwise }),

  // ==========================================================================
  // Literals
  // ==========================================================================

  /**
   * String literal
   */
  str: (value: string): Expression => Expression.Literal({ value: JSON.stringify(value) }),

  /**
   * Number literal
   */
  num: (value: number): Expression => Expression.Literal({ value: String(value) }),

  /**
   * Boolean literal
   */
  bool: (value: boolean): Expression => Expression.Literal({ value: String(value) }),

  /**
   * Null literal
   */
  null: (): Expression => Expression.Literal({ value: "null" }),

  /**
   * Undefined literal
   */
  undefined: (): Expression => Expression.Literal({ value: "undefined" }),

  // ==========================================================================
  // Function Calls - Type Conversion
  // ==========================================================================

  /**
   * parseInt with optional fallback
   * @example $.parseInt($.signal("amount"))  // parseInt($amount.value)
   * @example $.parseInt($.signal("amount"), $.num(0))  // parseInt($amount.value) || 0
   */
  parseInt: (e: Expression, fallback?: Expression): Expression =>
    fallback
      ? Expression.Binary({
          left: Expression.Call({ fn: "parseInt", args: [e] }),
          op: "||",
          right: fallback,
        })
      : Expression.Call({ fn: "parseInt", args: [e] }),

  /**
   * parseFloat with optional fallback
   */
  parseFloat: (e: Expression, fallback?: Expression): Expression =>
    fallback
      ? Expression.Binary({
          left: Expression.Call({ fn: "parseFloat", args: [e] }),
          op: "||",
          right: fallback,
        })
      : Expression.Call({ fn: "parseFloat", args: [e] }),

  /**
   * Convert to string
   */
  toString: (e: Expression): Expression =>
    Expression.Call({ fn: "String", args: [e] }),

  /**
   * Convert to number
   */
  toNumber: (e: Expression): Expression =>
    Expression.Call({ fn: "Number", args: [e] }),

  /**
   * Convert to boolean
   */
  toBoolean: (e: Expression): Expression =>
    Expression.Unary({ op: "!", expr: Expression.Unary({ op: "!", expr: e }) }),

  // ==========================================================================
  // String Operations
  // ==========================================================================

  /**
   * String trim
   */
  trim: (e: Expression): Expression =>
    Expression.Member({ object: e, property: "trim()" }),

  /**
   * String toLowerCase
   */
  toLowerCase: (e: Expression): Expression =>
    Expression.Member({ object: e, property: "toLowerCase()" }),

  /**
   * String toUpperCase
   */
  toUpperCase: (e: Expression): Expression =>
    Expression.Member({ object: e, property: "toUpperCase()" }),

  /**
   * String length
   */
  length: (e: Expression): Expression =>
    Expression.Member({ object: e, property: "length" }),

  // ==========================================================================
  // Property Access
  // ==========================================================================

  /**
   * Access a property on an expression
   * @example $.prop($.signal("user"), "name")  // $user.value.name
   */
  prop: (e: Expression, property: string): Expression =>
    Expression.Member({ object: e, property }),

  // ==========================================================================
  // Object and Array Literals
  // ==========================================================================

  /**
   * Create an object literal expression
   * @example $.obj({ amount: $.parseInt($.signal("amount")) })
   */
  obj: (entries: Record<string, Expression>): Expression =>
    Expression.ObjectLit({ entries }),

  /**
   * Create an array literal expression
   */
  arr: (...items: Expression[]): Expression =>
    Expression.ArrayLit({ items }),

  // ==========================================================================
  // Generic Function Call
  // ==========================================================================

  /**
   * Call any function
   * @example $.call("console.log", $.signal("message"))
   */
  call: (fn: string, ...args: Expression[]): Expression =>
    Expression.Call({ fn, args }),

  // ==========================================================================
  // Event-specific Helpers
  // ==========================================================================

  /**
   * Get event target value (e.target.value)
   */
  eventValue: (): Expression =>
    Expression.Member({
      object: Expression.Member({
        object: Expression.Literal({ value: "event" }),
        property: "target",
      }),
      property: "value",
    }),

  /**
   * Get event target checked (e.target.checked)
   */
  eventChecked: (): Expression =>
    Expression.Member({
      object: Expression.Member({
        object: Expression.Literal({ value: "event" }),
        property: "target",
      }),
      property: "checked",
    }),
}

// ============================================================================
// Type-Safe Signal Binding Helpers
// ============================================================================

/**
 * Type-safe signal binding helpers for form inputs.
 * Generates the appropriate hs-bind attributes.
 *
 * @example
 * // Before (magic string):
 * UI.input({ attrs: { "hs-bind": "newTodo" } })
 *
 * // After (type-safe):
 * UI.input({ attrs: { ...bind.input(ctx.signals.newTodo) } })
 */
export const bind = {
  /**
   * Bind a string signal to an input's value
   */
  input: (signal: SignalAccessor<string>): { "hs-bind": string } => ({
    "hs-bind": signal.name,
  }),

  /**
   * Bind a boolean signal to a checkbox's checked state
   */
  checked: (signal: BooleanSignalAccessor): { "hs-bind-checked": string } => ({
    "hs-bind-checked": signal.name,
  }),
}
