/**
 * Hyperstar v3 - Effect Services
 *
 * All capabilities are explicit Effect Services.
 * AI agents see exactly what's available and what they depend on.
 */
import { Context, Effect, Layer, SubscriptionRef, Stream, Schema } from "effect"
import type { StoreError, SSEError, SignalError } from "./errors"

// ============================================================================
// Schema-Defined SSE Events (Type-safe serialization/deserialization)
// ============================================================================

/**
 * SSE Event Schemas - All SSE events are schema-validated
 * This ensures type safety for both server encoding and client decoding
 */
export const SSEMorphEvent = Schema.Struct({
  type: Schema.Literal("morph"),
  data: Schema.Struct({
    html: Schema.String,
    target: Schema.optionalWith(Schema.String, { default: () => "app" }),
  }),
})

export const SSESignalsEvent = Schema.Struct({
  type: Schema.Literal("signals"),
  data: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

export const SSEExecuteEvent = Schema.Struct({
  type: Schema.Literal("execute"),
  data: Schema.Struct({
    script: Schema.String,
  }),
})

export const SSERedirectEvent = Schema.Struct({
  type: Schema.Literal("redirect"),
  data: Schema.Struct({
    url: Schema.String,
    replace: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  }),
})

export const SSEErrorEvent = Schema.Struct({
  type: Schema.Literal("error"),
  data: Schema.Struct({
    message: Schema.String,
    code: Schema.optional(Schema.String),
  }),
})

export const SSETitleEvent = Schema.Struct({
  type: Schema.Literal("title"),
  data: Schema.Struct({
    title: Schema.String,
  }),
})

export const SSEFaviconEvent = Schema.Struct({
  type: Schema.Literal("favicon"),
  data: Schema.Struct({
    href: Schema.String,
    type: Schema.optionalWith(Schema.String, { default: () => "image/x-icon" }),
  }),
})

// ============================================================================
// Task SSE Events
// ============================================================================

/** Background task progress */
export const SSETaskProgressEvent = Schema.Struct({
  type: Schema.Literal("task:progress"),
  data: Schema.Struct({
    taskId: Schema.String,
    progress: Schema.Number,
    message: Schema.optional(Schema.String),
    stage: Schema.optional(Schema.String),
  }),
})

/** Task completion */
export const SSETaskCompleteEvent = Schema.Struct({
  type: Schema.Literal("task:complete"),
  data: Schema.Struct({
    taskId: Schema.String,
    result: Schema.optional(Schema.Unknown),
    error: Schema.optional(Schema.String),
  }),
})

/** Union of all SSE event types */
export const SSEEventSchema = Schema.Union(
  SSEMorphEvent,
  SSESignalsEvent,
  SSEExecuteEvent,
  SSERedirectEvent,
  SSEErrorEvent,
  SSETitleEvent,
  SSEFaviconEvent,
  SSETaskProgressEvent,
  SSETaskCompleteEvent,
)

/** Inferred SSE event types */
export type SSEMorphEvent = typeof SSEMorphEvent.Type
export type SSESignalsEvent = typeof SSESignalsEvent.Type
export type SSEExecuteEvent = typeof SSEExecuteEvent.Type
export type SSERedirectEvent = typeof SSERedirectEvent.Type
export type SSEErrorEvent = typeof SSEErrorEvent.Type
export type SSETitleEvent = typeof SSETitleEvent.Type
export type SSEFaviconEvent = typeof SSEFaviconEvent.Type
export type SSETaskProgressEvent = typeof SSETaskProgressEvent.Type
export type SSETaskCompleteEvent = typeof SSETaskCompleteEvent.Type
export type SSEEventTyped = typeof SSEEventSchema.Type

/** Helper to create typed SSE events */
export const SSE = {
  morph: (html: string, target?: string): SSEMorphEvent => ({
    type: "morph",
    data: { html, target: target ?? "app" },
  }),
  signals: (patches: Record<string, unknown>): SSESignalsEvent => ({
    type: "signals",
    data: patches,
  }),
  execute: (script: string): SSEExecuteEvent => ({
    type: "execute",
    data: { script },
  }),
  redirect: (url: string, replace = false): SSERedirectEvent => ({
    type: "redirect",
    data: { url, replace },
  }),
  error: (message: string, code?: string): SSEErrorEvent => ({
    type: "error",
    data: { message, code },
  }),
  title: (title: string): SSETitleEvent => ({
    type: "title",
    data: { title },
  }),
  favicon: (href: string, type?: string): SSEFaviconEvent => ({
    type: "favicon",
    data: { href, type: type ?? "image/x-icon" },
  }),
  /** Task progress event */
  taskProgress: (
    taskId: string,
    progress: number,
    message?: string,
    stage?: string,
  ): SSETaskProgressEvent => ({
    type: "task:progress",
    data: { taskId, progress, message, stage },
  }),
  /** Task completion event */
  taskComplete: (
    taskId: string,
    result?: unknown,
    error?: string,
  ): SSETaskCompleteEvent => ({
    type: "task:complete",
    data: { taskId, result, error },
  }),
  /** Encode an event to JSON string for SSE transmission */
  encode: (event: SSEEventTyped): string =>
    JSON.stringify(Schema.encodeSync(SSEEventSchema)(event)),
  /** Decode a JSON string back to a typed event */
  decode: (json: string): SSEEventTyped =>
    Schema.decodeUnknownSync(SSEEventSchema)(JSON.parse(json)),
}

// ============================================================================
// Session Service - Per-request context
// ============================================================================

export interface Session {
  readonly id: string
  readonly userId: string | null
  readonly connectedAt: Date
}

export class SessionService extends Context.Tag("hyperstar/SessionService")<
  SessionService,
  {
    readonly current: Session
    readonly isAuthenticated: boolean
  }
>() {
  static readonly make = (session: Session) =>
    Layer.succeed(SessionService, {
      current: session,
      isAuthenticated: session.userId !== null,
    })
}

// ============================================================================
// Store Service - Reactive state management
// ============================================================================

export interface StoreServiceApi<S> {
  /** Get current state */
  readonly get: Effect.Effect<S, StoreError>
  /** Update state with a function */
  readonly update: (fn: (s: S) => S) => Effect.Effect<void, StoreError>
  /** Set state directly */
  readonly set: (s: S) => Effect.Effect<void, StoreError>
  /** Subscribe to state changes */
  readonly changes: Stream.Stream<S, StoreError>
  /** Access raw SubscriptionRef for advanced use */
  readonly ref: SubscriptionRef.SubscriptionRef<S>

  // =========================================================================
  // Convenience Helpers
  // =========================================================================

  /** Set a single key in the state */
  readonly setKey: <K extends keyof S>(
    key: K,
    value: S[K],
  ) => Effect.Effect<void, StoreError>

  /** Append an item to an array field */
  readonly append: <K extends keyof S>(
    key: K,
    item: S[K] extends ReadonlyArray<infer T> ? T : never,
  ) => Effect.Effect<void, StoreError>

  /** Filter an array field */
  readonly filter: <K extends keyof S>(
    key: K,
    predicate: (
      item: S[K] extends ReadonlyArray<infer T> ? T : never,
    ) => boolean,
  ) => Effect.Effect<void, StoreError>

  /** Map over an array field */
  readonly map: <K extends keyof S>(
    key: K,
    fn: (
      item: S[K] extends ReadonlyArray<infer T> ? T : never,
    ) => S[K] extends ReadonlyArray<infer T> ? T : never,
  ) => Effect.Effect<void, StoreError>
}

// Use a type-safe accessor function instead of generic class
export const StoreService = Context.GenericTag<StoreServiceApi<unknown>>(
  "hyperstar/StoreService",
)

/** Get a typed StoreService */
export const getStoreService = <S>() =>
  StoreService as Context.Tag<StoreServiceApi<S>, StoreServiceApi<S>>

// ============================================================================
// User Store Service - Per-user state
// ============================================================================

export interface UserStoreServiceApi<U> {
  /** Get user state for current session */
  readonly get: Effect.Effect<U, StoreError>
  /** Update user state */
  readonly update: (fn: (u: U) => U) => Effect.Effect<void, StoreError>
  /** Get state for specific user */
  readonly getForUser: (userId: string) => Effect.Effect<U, StoreError>
  /** Update state for specific user */
  readonly updateForUser: (
    userId: string,
    fn: (u: U) => U,
  ) => Effect.Effect<void, StoreError>
}

export const UserStoreService = Context.GenericTag<UserStoreServiceApi<unknown>>(
  "hyperstar/UserStoreService",
)

/** Get a typed UserStoreService */
export const getUserStoreService = <U>() =>
  UserStoreService as Context.Tag<UserStoreServiceApi<U>, UserStoreServiceApi<U>>

// ============================================================================
// SSE Service - Server-Sent Events
// ============================================================================

/** @deprecated Use SSEEventTyped instead for type-safe events */
export type SSEEvent = {
  readonly type: "morph" | "signals" | "execute" | "redirect" | "error"
  readonly data: unknown
}

export interface SSEClient {
  readonly sessionId: string
  readonly userId: string | null
  readonly send: (event: SSEEventTyped) => Effect.Effect<void, SSEError>
  readonly close: Effect.Effect<void>
}

export interface SSEServiceApi {
  /** Broadcast to all connected clients (type-safe) */
  readonly broadcast: (event: SSEEventTyped) => Effect.Effect<void, SSEError>
  /** Send to specific session (type-safe) */
  readonly sendTo: (
    sessionId: string,
    event: SSEEventTyped,
  ) => Effect.Effect<void, SSEError>
  /** Send to specific user (all their sessions) */
  readonly sendToUser: (
    userId: string,
    event: SSEEventTyped,
  ) => Effect.Effect<void, SSEError>
  /** Get connected client count */
  readonly connectionCount: Effect.Effect<number>
  /** Register a new client */
  readonly register: (client: SSEClient) => Effect.Effect<void>
  /** Unregister a client */
  readonly unregister: (sessionId: string) => Effect.Effect<void>
  /** Stream of connection events */
  readonly connections: Stream.Stream<
    { type: "connect" | "disconnect"; client: SSEClient },
    SSEError
  >
}

export class SSEService extends Context.Tag("hyperstar/SSEService")<
  SSEService,
  SSEServiceApi
>() {}

// ============================================================================
// Signal Service - Client-side state management
// ============================================================================

export interface SignalPatch {
  readonly sessionId: string
  readonly patches: Record<string, unknown>
}

export interface SignalServiceApi {
  /** Patch signals for current session */
  readonly patch: (
    patches: Record<string, unknown>,
  ) => Effect.Effect<void, SignalError>
  /** Patch signals for specific session */
  readonly patchFor: (
    sessionId: string,
    patches: Record<string, unknown>,
  ) => Effect.Effect<void, SignalError>
  /** Get signal value for session */
  readonly get: (
    sessionId: string,
    name: string,
  ) => Effect.Effect<unknown, SignalError>
}

export class SignalService extends Context.Tag("hyperstar/SignalService")<
  SignalService,
  SignalServiceApi
>() {}

// ============================================================================
// Action Registry Service - Action management
// ============================================================================

export interface ActionMeta {
  readonly id: string
  readonly name: string
  readonly hasArgs: boolean
}

export interface ActionRegistryApi {
  /** Register an action */
  readonly register: (meta: ActionMeta, handler: unknown) => Effect.Effect<void>
  /** Get action by ID */
  readonly get: (id: string) => Effect.Effect<ActionMeta | null>
  /** List all registered actions */
  readonly list: Effect.Effect<readonly ActionMeta[]>
  /** Execute an action */
  readonly execute: (
    id: string,
    args: unknown,
  ) => Effect.Effect<void, import("./errors").ActionError>
}

export class ActionRegistry extends Context.Tag("hyperstar/ActionRegistry")<
  ActionRegistry,
  ActionRegistryApi
>() {}

// ============================================================================
// Render Service - HTML rendering
// ============================================================================

export interface RenderServiceApi {
  /** Render view to HTML string */
  readonly render: () => Effect.Effect<string, import("./errors").RenderError>
  /** Render partial (specific element) */
  readonly renderPartial: (
    elementId: string,
  ) => Effect.Effect<string, import("./errors").RenderError>
}

export class RenderService extends Context.Tag("hyperstar/RenderService")<
  RenderService,
  RenderServiceApi
>() {}

// ============================================================================
// Combined App Services Type
// ============================================================================

export type AppServices =
  | typeof SessionService
  | typeof StoreService
  | typeof UserStoreService
  | typeof SSEService
  | typeof SignalService
  | typeof ActionRegistry
  | typeof RenderService
