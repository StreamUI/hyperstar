/**
 * Hyperstar v3 - UI Algebraic Data Types
 *
 * UI as typed AST using Data.TaggedEnum.
 * AI agents can manipulate, validate, and transform UI as structured data.
 * Exhaustive pattern matching catches missing cases at compile time.
 */
import { Data } from "effect"

// ============================================================================
// Expression - Client-side reactive expressions
// ============================================================================

/**
 * Expressions represent client-side JavaScript that will be evaluated.
 * They compile to strings but maintain type information for composition.
 */
export type Expression = Data.TaggedEnum<{
  /** Literal JavaScript expression */
  Literal: { readonly value: string }
  /** Signal reference */
  Signal: { readonly name: string }
  /** Binary operation */
  Binary: {
    readonly left: Expression
    readonly op: "&&" | "||" | "===" | "!==" | ">" | "<" | ">=" | "<=" | "+" | "-" | "*" | "/" | "??"
    readonly right: Expression
  }
  /** Unary operation */
  Unary: { readonly op: "!" | "-" | "+" | "typeof"; readonly expr: Expression }
  /** Ternary expression */
  Ternary: {
    readonly condition: Expression
    readonly then: Expression
    readonly else: Expression
  }
  /** Function call */
  Call: {
    readonly fn: string
    readonly args: readonly Expression[]
  }
  /** Property/method access */
  Member: {
    readonly object: Expression
    readonly property: string
  }
  /** Object literal */
  ObjectLit: {
    readonly entries: Readonly<Record<string, Expression>>
  }
  /** Array literal */
  ArrayLit: {
    readonly items: readonly Expression[]
  }
}>

export const Expression = Data.taggedEnum<Expression>()

/** Helper to create expression from string */
export const expr = (value: string): Expression => Expression.Literal({ value })

/** Helper to reference a signal */
export const signal = (name: string): Expression => Expression.Signal({ name })

/** Compile expression to JavaScript string */
export const compileExpr = (e: Expression): string =>
  Expression.$match(e, {
    Literal: ({ value }) => value,
    Signal: ({ name }) => `$${name}.value`,
    Binary: ({ left, op, right }) =>
      `(${compileExpr(left)} ${op} ${compileExpr(right)})`,
    Unary: ({ op, expr }) => `${op}(${compileExpr(expr)})`,
    Ternary: ({ condition, then, else: otherwise }) =>
      `(${compileExpr(condition)} ? ${compileExpr(then)} : ${compileExpr(otherwise)})`,
    Call: ({ fn, args }) =>
      `${fn}(${args.map(compileExpr).join(", ")})`,
    Member: ({ object, property }) =>
      `${compileExpr(object)}.${property}`,
    ObjectLit: ({ entries }) =>
      `({ ${Object.entries(entries)
        .map(([k, v]) => `${k}: ${compileExpr(v)}`)
        .join(", ")} })`,
    ArrayLit: ({ items }) =>
      `[${items.map(compileExpr).join(", ")}]`,
  })

// ============================================================================
// Attribute Types
// ============================================================================

/**
 * Attribute values can be static or dynamic (expression-based)
 */
export type AttrValue = Data.TaggedEnum<{
  /** Static string value */
  Static: { readonly value: string }
  /** Dynamic expression (evaluated on client) */
  Dynamic: { readonly expr: Expression }
  /** Boolean attribute (present or absent) */
  Boolean: { readonly value: boolean }
  /** Conditional attribute value */
  Conditional: {
    readonly when: Expression
    readonly then: AttrValue
    readonly else: AttrValue
  }
}>

export const AttrValue = Data.taggedEnum<AttrValue>()

/** Helper for static attribute */
export const attr = (value: string): AttrValue => AttrValue.Static({ value })

/** Helper for dynamic attribute */
export const dynamicAttr = (expr: Expression): AttrValue =>
  AttrValue.Dynamic({ expr })

/** Helper for boolean attribute */
export const boolAttr = (value: boolean): AttrValue =>
  AttrValue.Boolean({ value })

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Argument value - can be static (JSON-serializable) or dynamic (Expression)
 */
export type ArgValue =
  | { readonly _type: "static"; readonly value: unknown }
  | { readonly _type: "dynamic"; readonly expr: Expression }

/** Helper to create static arg */
export const staticArg = (value: unknown): ArgValue => ({ _type: "static", value })

/** Helper to create dynamic arg */
export const dynamicArg = (expr: Expression): ArgValue => ({ _type: "dynamic", expr })

/** Check if value is an Expression */
export const isExpression = (value: unknown): value is Expression =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  typeof (value as { _tag: unknown })._tag === "string" &&
  ["Literal", "Signal", "Binary", "Unary", "Ternary", "Call", "Member", "ObjectLit", "ArrayLit"].includes(
    (value as { _tag: string })._tag,
  )

/** Normalize an arg value - detect Expression vs static */
export const normalizeArgValue = (value: unknown): ArgValue =>
  isExpression(value) ? dynamicArg(value) : staticArg(value)

export type EventHandler = Data.TaggedEnum<{
  /** Dispatch an action */
  Action: {
    readonly actionId: string
    readonly args: Record<string, ArgValue>
    readonly mode: "m" | "a" // morph or append
  }
  /** Execute inline JavaScript */
  Script: { readonly code: string }
  /** Update a signal */
  Signal: { readonly name: string; readonly expr: Expression }
  /** Multiple handlers */
  Sequence: { readonly handlers: readonly EventHandler[] }
}>

export const EventHandler = Data.taggedEnum<EventHandler>()

// ============================================================================
// UI Nodes - The Core ADT
// ============================================================================

/**
 * UINode represents all possible UI elements.
 * Pattern matching with $match is exhaustive - forget a case = compile error.
 */
export type UINode = Data.TaggedEnum<{
  /** Text content (escaped) */
  Text: { readonly content: string }

  /** Raw HTML (not escaped - use with caution) */
  Raw: { readonly html: string }

  /** HTML Element */
  Element: {
    readonly tag: string
    readonly attrs: Readonly<Record<string, AttrValue>>
    readonly events: Readonly<Record<string, EventHandler>>
    readonly children: readonly UINode[]
  }

  /** Fragment (multiple nodes without wrapper) */
  Fragment: { readonly children: readonly UINode[] }

  /** Conditional rendering */
  Conditional: {
    readonly when: Expression
    readonly then: UINode
    readonly else: UINode
  }

  /** List rendering */
  Each: {
    readonly items: readonly unknown[]
    readonly keyFn: (item: unknown, index: number) => string
    readonly renderFn: (item: unknown, index: number) => UINode
  }

  /** Named slot for composition */
  Slot: {
    readonly name: string
    readonly fallback: UINode | null
  }

  /** Empty node (renders nothing) */
  Empty: { readonly _empty?: undefined }
}>

export const UINode = Data.taggedEnum<UINode>()

// ============================================================================
// Type Guards
// ============================================================================

export const isElement = (node: UINode): node is Data.TaggedEnum.Value<UINode, "Element"> =>
  node._tag === "Element"

export const isText = (node: UINode): node is Data.TaggedEnum.Value<UINode, "Text"> =>
  node._tag === "Text"

export const isEmpty = (node: UINode): node is Data.TaggedEnum.Value<UINode, "Empty"> =>
  node._tag === "Empty"

// ============================================================================
// Node Transformations
// ============================================================================

/**
 * Map over all children in a node (shallow)
 */
export const mapChildren = (
  node: UINode,
  fn: (child: UINode) => UINode,
): UINode =>
  UINode.$match(node, {
    Text: (n) => n,
    Raw: (n) => n,
    Element: (n) => UINode.Element({ ...n, children: n.children.map(fn) }),
    Fragment: (n) => UINode.Fragment({ children: n.children.map(fn) }),
    Conditional: (n) => UINode.Conditional({ ...n, then: fn(n.then), else: fn(n.else) }),
    Each: (n) => n, // Each is special - renderFn handles children
    Slot: (n) => n.fallback ? UINode.Slot({ ...n, fallback: fn(n.fallback) }) : n,
    Empty: (n) => n,
  })

/**
 * Deep map over all nodes in the tree
 */
export const deepMap = (node: UINode, fn: (n: UINode) => UINode): UINode => {
  const mapped = fn(node)
  return mapChildren(mapped, (child) => deepMap(child, fn))
}

/**
 * Find all nodes matching a predicate
 */
export const findAll = (
  node: UINode,
  predicate: (n: UINode) => boolean,
): readonly UINode[] => {
  const results: UINode[] = []

  const visit = (n: UINode): void => {
    if (predicate(n)) {
      results.push(n)
    }
    UINode.$match(n, {
      Text: () => {},
      Raw: () => {},
      Element: ({ children }) => children.forEach(visit),
      Fragment: ({ children }) => children.forEach(visit),
      Conditional: ({ then, else: otherwise }) => {
        visit(then)
        visit(otherwise)
      },
      Each: () => {}, // Can't traverse dynamic content
      Slot: ({ fallback }) => fallback && visit(fallback),
      Empty: () => {},
    })
  }

  visit(node)
  return results
}

/**
 * Count total nodes in tree
 */
export const countNodes = (node: UINode): number => {
  let count = 1
  UINode.$match(node, {
    Text: () => {},
    Raw: () => {},
    Element: ({ children }) => {
      count += children.reduce((sum, c) => sum + countNodes(c), 0)
    },
    Fragment: ({ children }) => {
      count += children.reduce((sum, c) => sum + countNodes(c), 0)
    },
    Conditional: ({ then, else: otherwise }) => {
      count += countNodes(then) + countNodes(otherwise)
    },
    Each: () => {}, // Dynamic
    Slot: ({ fallback }) => {
      if (fallback) count += countNodes(fallback)
    },
    Empty: () => {},
  })
  return count
}
