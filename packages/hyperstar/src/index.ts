/**
 * Hyperstar v3 - Simplified API
 *
 * Small, cohesive DSL with power and strong typing.
 * ONE way to do each thing.
 *
 * @example
 * ```typescript
 * import { createHyperstar, UI, on, Schema } from "hyperstar"
 *
 * interface Store { count: number }
 *
 * const app = createHyperstar<Store>({
 *   store: { count: 0 },
 *   view: (ctx) => UI.div({},
 *     UI.h1({}, `Count: ${ctx.store.count}`),
 *     UI.button({ events: { click: on.action(increment) } }, "+1"),
 *   ),
 * })
 *
 * // Actions - ONE pattern
 * const increment = app.action("increment", ctx => {
 *   ctx.update(s => ({ ...s, count: s.count + 1 }))
 * })
 *
 * const add = app.action("add", { amount: Schema.Number }, (ctx, { amount }) => {
 *   ctx.update(s => ({ ...s, count: s.count + amount }))
 * })
 *
 * // Timer - game loops
 * app.timer("ticker", {
 *   interval: 16,
 *   when: s => s.running,
 *   handler: ctx => ctx.update(s => ({ ...s, frame: s.frame + 1 }))
 * })
 *
 * // Interval - simple repeating
 * app.interval("heartbeat", {
 *   every: "5 seconds",
 *   handler: ctx => console.log("heartbeat", ctx.getStore().count)
 * })
 *
 * // Cron - scheduled jobs
 * app.cron("cleanup", {
 *   schedule: "1 hour",
 *   handler: ctx => console.log("cleanup")
 * })
 *
 * // Triggers - react to changes
 * app.trigger("count-changed", {
 *   watch: s => s.count,
 *   handler: (ctx, { oldValue, newValue }) => {
 *     console.log(`Count: ${oldValue} → ${newValue}`)
 *   }
 * })
 *
 * app.serve({ port: 3000 })
 * ```
 */

// Core - Errors and Services (keep for power users)
export {
  RecoveryHint,
  Recovery,
  StoreError,
  ActionError,
  ValidationError,
  SSEError,
  SessionError,
  SignalError,
  RenderError,
  type AppError,
  handleAppError,
  logError,
  type Session,
  // Type-safe SSE
  SSEMorphEvent,
  SSESignalsEvent,
  SSEExecuteEvent,
  SSERedirectEvent,
  SSEErrorEvent,
  SSETitleEvent,
  SSEFaviconEvent,
  SSEEventSchema,
  type SSEEventTyped,
  SSE,
} from "./core"

// UI - ADT, Builder, Renderer
export {
  Expression,
  expr,
  signal,
  compileExpr,
  AttrValue,
  attr,
  dynamicAttr,
  boolAttr,
  EventHandler,
  UINode,
  isElement,
  isText,
  isEmpty,
  mapChildren,
  deepMap,
  findAll,
  countNodes,
  UI,
  on,
  $,
  bind,
  cx,
  escapeHtml,
  escapeAttr,
  render,
  renderEffect,
  renderDocument,
  prettyPrint,
} from "./ui"

// Actions - simplified context only
export {
  type ActionContext,
  type SimplifiedActionContext,
  type SimplifiedHeadService,
  type HeadServiceApi,
  type ActionDescriptor,
} from "./action"

// Signals
export {
  type SignalScope,
  type SignalDef,
  type BooleanSignalDef,
  type NumberSignalDef,
  type StringSignalDef,
  type EnumSignalDef,
  type NullableSignalDef,
  type AnySignalDef,
  type SignalAccessor,
  type BooleanSignalAccessor,
  type NumberSignalAccessor,
  type StringSignalAccessor,
  type EnumSignalAccessor,
  type NullableSignalAccessor,
  type SignalProtocol,
  Signal,
} from "./signals"

// Server - main entry point
export {
  type HyperstarConfig,
  type ViewContext,
  type ServeOptions,
  type HyperstarFactory,
  type HyperstarApp,
  // Config types for timer/interval/cron
  type TimerConfig,
  type TimerHandlerContext,
  type TimerHandle,
  type IntervalConfig,
  type IntervalHandlerContext,
  type IntervalHandle,
  type CronConfig,
  type CronHandlerContext,
  type CronUserContext,
  type CronHandle,
  // Signal handle types (from hs.signal())
  type SignalHandle,
  type StringSignalHandle,
  type BooleanSignalHandle,
  type NumberSignalHandle,
  type NullableSignalHandle,
  createServer,
  createHyperstar,
} from "./server"

// Lifecycle (simplified)
export {
  type LifecycleContext,
} from "./core/lifecycle"

// Triggers
export {
  type TriggerHandle,
  type TriggerContext,
  type UserTriggerContext,
  type TriggerChange,
  type UserTriggerChange,
} from "./triggers"

// Schedule - keep Cron helper
export { Cron } from "./schedule"

// createHyperstar is exported from "./server" above

// Re-export Schema from Effect for action args
export { Schema } from "effect"
