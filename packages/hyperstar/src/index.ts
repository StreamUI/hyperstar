/**
 * Hyperstar v3 - JSX-First Server-Driven UI
 *
 * Build real-time web apps with JSX and server-side state.
 * Uses Kita HTML for fast JSX rendering.
 *
 * @example
 * ```tsx
 * import { createHyperstar, hs, Schema } from "hyperstar"
 *
 * interface Store { count: number }
 *
 * const app = createHyperstar<Store>()
 *
 * const increment = app.action("increment", ctx => {
 *   ctx.update(s => ({ ...s, count: s.count + 1 }))
 * })
 *
 * app.app({
 *   store: { count: 0 },
 *   view: (ctx) => (
 *     <div>
 *       <h1>Count: {ctx.store.count}</h1>
 *       <button $={hs.action(increment)}>+1</button>
 *     </div>
 *   ),
 * }).serve({ port: 3000 })
 * ```
 */

// Core - Errors and Services
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

// Actions - simplified context only
export {
  type ActionContext,
  type SimplifiedActionContext,
  type SimplifiedHeadService,
  type HeadServiceApi,
  type ActionDescriptor,
  type Action,
} from "./action"

// Signals (protocol types for type-safe signal handles)
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
  // Expression class for JSX views
  Expr,
  createServer,
  createHyperstar,
} from "./server"

// JSX View Helpers - the $ prop API
export { hs, HSBuilder } from "./hs"

// JSX type extensions (import for side effects)
import "./jsx.d.ts"

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

// Re-export Schema from Effect for action args
export { Schema } from "effect"
