/**
 * Hyperstar v3 - UI Renderer
 *
 * Exhaustive ADT → HTML conversion.
 * All UINode cases must be handled - missing cases are compile errors.
 */
import { Effect } from "effect"
import { UINode, AttrValue, EventHandler, compileExpr, type ArgValue } from "./nodes"
import { RenderError, Recovery } from "../core/errors"

// ============================================================================
// HTML Escaping
// ============================================================================

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export const escapeHtml = (str: string): string =>
  str.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char)

export const escapeAttr = (str: string): string =>
  str.replace(/[&"]/g, (char) => ESCAPE_MAP[char] ?? char)

// ============================================================================
// Void Elements (self-closing)
// ============================================================================

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
])

// ============================================================================
// Attribute Rendering
// ============================================================================

const renderAttrValue = (value: AttrValue): string =>
  AttrValue.$match(value, {
    Static: ({ value }) => escapeAttr(value),
    Dynamic: ({ expr }) => `\${${compileExpr(expr)}}`,
    Boolean: ({ value }) => (value ? "" : null as never), // Handled in renderAttrs
    Conditional: ({ when, then, else: otherwise }) =>
      `\${${compileExpr(when)} ? '${renderAttrValue(then)}' : '${renderAttrValue(otherwise)}'}`,
  })

const renderAttrs = (
  attrs: Readonly<Record<string, AttrValue>>,
  events: Readonly<Record<string, EventHandler>>,
): string => {
  const parts: string[] = []

  // Render regular attributes
  for (const [name, value] of Object.entries(attrs)) {
    if (value._tag === "Boolean") {
      if (value.value) {
        parts.push(name)
      }
      // If false, omit entirely
    } else {
      parts.push(`${name}="${renderAttrValue(value)}"`)
    }
  }

  // Render event handlers as hs-on:* attributes
  for (const [event, handler] of Object.entries(events)) {
    const handlerCode = renderEventHandler(handler)
    parts.push(`hs-on:${event}="${escapeAttr(handlerCode)}"`)
  }

  return parts.length > 0 ? " " + parts.join(" ") : ""
}

// ============================================================================
// Event Handler Rendering
// ============================================================================

/**
 * Compile an ArgValue to JavaScript code.
 * Static values are JSON-stringified, dynamic values are compiled as expressions.
 */
const compileArgValue = (arg: ArgValue): string =>
  arg._type === "static" ? JSON.stringify(arg.value) : compileExpr(arg.expr)

/**
 * Compile action args to a JavaScript object literal.
 * Handles both static and dynamic values.
 */
const compileActionArgs = (args: Record<string, ArgValue>): string => {
  const entries = Object.entries(args)
  if (entries.length === 0) return "{}"

  // Check if all args are static (can use simple JSON)
  const allStatic = entries.every(([, v]) => v._type === "static")
  if (allStatic) {
    const staticObj: Record<string, unknown> = {}
    for (const [k, v] of entries) {
      if (v._type === "static") {
        staticObj[k] = v.value
      }
    }
    return JSON.stringify(staticObj)
  }

  // Mix of static and dynamic - generate object literal expression
  const parts = entries.map(([k, v]) => `${k}: ${compileArgValue(v)}`)
  return `({ ${parts.join(", ")} })`
}

const renderEventHandler = (handler: EventHandler): string =>
  EventHandler.$match(handler, {
    Action: ({ actionId, args, mode }) =>
      `Hyperstar.dispatch('${mode}','${actionId}',${compileActionArgs(args)})`,
    Script: ({ code }) => code,
    Signal: ({ name, expr }) => `$${name}.value = ${compileExpr(expr)}`,
    Sequence: ({ handlers }) =>
      handlers.map(renderEventHandler).join("; "),
  })

// ============================================================================
// Main Renderer - Exhaustive Pattern Matching
// ============================================================================

/**
 * Render a UINode to HTML string.
 *
 * Uses exhaustive pattern matching - if a new UINode variant is added,
 * this function will fail to compile until the new case is handled.
 */
export const render = (node: UINode): string =>
  UINode.$match(node, {
    Text: ({ content }) => escapeHtml(content),

    Raw: ({ html }) => html,

    Element: ({ tag, attrs, events, children }) => {
      const attrStr = renderAttrs(attrs, events)
      if (VOID_ELEMENTS.has(tag)) {
        return `<${tag}${attrStr} />`
      }
      const childrenHtml = children.map(render).join("")
      return `<${tag}${attrStr}>${childrenHtml}</${tag}>`
    },

    Fragment: ({ children }) => children.map(render).join(""),

    Conditional: ({ when, then, else: otherwise }) => {
      const condition = compileExpr(when)

      // If the condition is a static boolean, render only the appropriate branch
      // This handles server-side evaluated conditions like UI.show(myBool, ...)
      if (condition === "true") {
        return render(then)
      }
      if (condition === "false") {
        return render(otherwise)
      }

      // Dynamic condition - render both branches with template tags for client-side JS
      const thenHtml = render(then)
      const elseHtml = render(otherwise)
      return (
        `<template hs-if="${escapeAttr(condition)}">${thenHtml}</template>` +
        `<template hs-else>${elseHtml}</template>`
      )
    },

    Each: ({ items, keyFn, renderFn }) =>
      items
        .map((item, index) => {
          const key = keyFn(item, index)
          const content = render(renderFn(item, index))
          return `<div hs-key="${escapeAttr(key)}">${content}</div>`
        })
        .join(""),

    Slot: ({ fallback }) => (fallback ? render(fallback) : ""),

    Empty: () => "",
  })

// ============================================================================
// Effect-Based Renderer (with error handling)
// ============================================================================

/**
 * Render with proper error handling and recovery hints.
 */
export const renderEffect = (
  node: UINode,
  component = "root",
): Effect.Effect<string, RenderError> =>
  Effect.try({
    try: () => render(node),
    catch: (cause) =>
      new RenderError({
        component,
        cause,
        recovery: Recovery.escalate(
          `Failed to render component: ${component}`,
          "RENDER_ERROR",
        ),
      }),
  })

/**
 * Render to full HTML document
 */
export const renderDocument = (
  node: UINode,
  options: {
    title?: string
    head?: string
    scripts?: string[]
    styles?: string[]
  } = {},
): string => {
  const body = render(node)
  const title = options.title ?? "Hyperstar App"
  const head = options.head ?? ""
  const scripts = options.scripts ?? []
  const styles = options.styles ?? []

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${styles.map((s) => `<link rel="stylesheet" href="${escapeAttr(s)}">`).join("\n  ")}
  ${head}
</head>
<body>
  ${body}
  ${scripts.map((s) => `<script src="${escapeAttr(s)}"></script>`).join("\n  ")}
</body>
</html>`
}

// ============================================================================
// Pretty Printer (for debugging)
// ============================================================================

/**
 * Pretty print a UINode tree for debugging
 */
export const prettyPrint = (node: UINode, indent = 0): string => {
  const pad = "  ".repeat(indent)

  return UINode.$match(node, {
    Text: ({ content }) => `${pad}Text("${content}")`,

    Raw: ({ html }) => `${pad}Raw(${html.length} chars)`,

    Element: ({ tag, attrs, children }) => {
      const attrKeys = Object.keys(attrs)
      const attrStr = attrKeys.length > 0 ? ` [${attrKeys.join(", ")}]` : ""
      const childStr =
        children.length > 0
          ? "\n" + children.map((c) => prettyPrint(c, indent + 1)).join("\n")
          : ""
      return `${pad}Element(${tag}${attrStr})${childStr}`
    },

    Fragment: ({ children }) =>
      `${pad}Fragment\n${children.map((c) => prettyPrint(c, indent + 1)).join("\n")}`,

    Conditional: ({ then, else: otherwise }) =>
      `${pad}Conditional\n${prettyPrint(then, indent + 1)}\n${prettyPrint(otherwise, indent + 1)}`,

    Each: ({ items }) => `${pad}Each(${items.length} items)`,

    Slot: ({ name, fallback }) =>
      `${pad}Slot(${name})${fallback ? "\n" + prettyPrint(fallback, indent + 1) : ""}`,

    Empty: () => `${pad}Empty`,
  })
}
