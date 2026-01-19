/**
 * Hyperstar v3 - UI Module
 *
 * Re-exports all UI types, nodes, builder, and renderer.
 */

// Core ADT types
export {
  Expression,
  expr,
  signal,
  compileExpr,
  AttrValue,
  attr,
  dynamicAttr,
  boolAttr,
  type ArgValue,
  staticArg,
  dynamicArg,
  isExpression,
  normalizeArgValue,
  EventHandler,
  UINode,
  isElement,
  isText,
  isEmpty,
  mapChildren,
  deepMap,
  findAll,
  countNodes,
} from "./nodes"

// Builder API
export { UI, on, $, cx, bind } from "./builder"

// Renderer
export {
  escapeHtml,
  escapeAttr,
  render,
  renderEffect,
  renderDocument,
  prettyPrint,
} from "./render"
