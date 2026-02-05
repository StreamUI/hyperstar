/**
 * Hyperstar v3 - Factory Pattern Server
 *
 * Two-phase setup: define actions first, then configure app with view.
 * This allows views to reference action variables directly.
 *
 * @example
 * ```tsx
 * const app = createHyperstar<Store, UserStore>()
 *
 * // Define actions first
 * const increment = app.action("increment", (ctx) => {
 *   ctx.update(s => ({ ...s, count: s.count + 1 }))
 * })
 *
 * // Configure app with JSX view that references actions
 * app.app({
 *   store: { count: 0 },
 *   view: (ctx) => <button $={hs.action(increment)}>+1</button>
 * }).serve({ port: 3000 })
 * ```
 */
import { Effect, SubscriptionRef, Stream, pipe, Schedule, Ref, Fiber, Cron, Duration, Either, Scope, Exit } from "effect"
import * as fs from "node:fs"
import * as path from "node:path"
import { type Session, SSE, type SSEEventTyped } from "./core/services"

// ============================================================================
// Client Bundle Cache
// ============================================================================

let clientBundleCache: string | null = null

// Clear cache on every request during development
const isDev = process.env.NODE_ENV !== "production"

/**
 * Get the bundled hyperstar-client script.
 * Priority:
 * 1. Use pre-bundled dist/hyperstar.min.js (for npm installs)
 * 2. Bundle from source at runtime (for monorepo development)
 * 3. Fallback to inline ESM imports
 */
async function getClientBundle(): Promise<string> {
  // In dev mode, always rebuild to pick up changes
  if (clientBundleCache && !isDev) return clientBundleCache

  // Try pre-bundled file first (for npm installs)
  const preBundledPath = path.resolve(__dirname, "../dist/hyperstar.min.js")
  if (fs.existsSync(preBundledPath)) {
    clientBundleCache = fs.readFileSync(preBundledPath, "utf-8")
    return clientBundleCache
  }

  try {
    // Fall back to runtime bundling (for monorepo development)
    const clientEntry = path.resolve(__dirname, "../../hyperstar-client/src/index.ts")

    // Bundle with Bun
    const result = await Bun.build({
      entrypoints: [clientEntry],
      minify: true,
      target: "browser",
      format: "esm",
    })

    if (!result.success) {
      console.error("[hyperstar] Failed to bundle client:", result.logs)
      throw new Error("Client bundle failed")
    }

    const bundle = result.outputs[0]
    if (!bundle) {
      throw new Error("Client bundle produced no output")
    }
    clientBundleCache = await bundle.text()
    return clientBundleCache
  } catch (e) {
    console.error("[hyperstar] Error bundling client:", e)
    // Fallback to inline ESM imports if bundling fails
    return `
      import { signal, effect, batch } from "https://esm.sh/@preact/signals-core@1.8.0";
      import { Idiomorph } from "https://esm.sh/idiomorph@0.7.4";
      console.warn("[hyperstar] Using fallback client - bundling failed");
      window.Hyperstar = {
        dispatch: async (actionId, args) => {
          const response = await fetch("/hs/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: window.__hs_sessionId, actionId, args, signals: {} })
          });
          if (!response.ok) console.error("Action failed:", await response.text());
        }
      };
    `
  }
}
import {
  type ActionDescriptor,
  type SimplifiedActionContext,
  createNoArgsAction,
  createWithArgsAction,
} from "./action/schema"
import { Schema } from "effect"
import { type LifecycleContext, createLifecycleContext } from "./core/lifecycle"

// ============================================================================
// Signal Types
// ============================================================================

/**
 * Expression class for reactive conditionals.
 * Generates JavaScript expression strings for hs-show/hs-class attributes.
 */
export class Expr {
  constructor(public readonly code: string) {}

  and(other: Expr | boolean): Expr {
    if (typeof other === "boolean") return new Expr(`(${this.code}) && ${other}`)
    return new Expr(`(${this.code}) && (${other.code})`)
  }

  or(other: Expr | boolean): Expr {
    if (typeof other === "boolean") return new Expr(`(${this.code}) || ${other}`)
    return new Expr(`(${this.code}) || (${other.code})`)
  }

  not(): Expr {
    return new Expr(`!(${this.code})`)
  }

  toString(): string {
    return this.code
  }

  /**
   * Auto-convert to string in JSX/template contexts.
   * Eliminates the need for .toString() on Expr values.
   */
  [Symbol.toPrimitive](hint: string): string {
    return this.code
  }

  toJSON(): string {
    return this.code
  }

  valueOf(): string {
    return this.code
  }
}

/**
 * Signal handle returned by hs.signal()
 * Provides the signal name and expression builders for conditionals.
 */
export interface SignalHandle<T> {
  readonly name: string
  readonly defaultValue: T
  /** Expression: $name.value */
  readonly expr: Expr
  /** Set signal to value: $name.value = value */
  set(value: T): Expr
  /** Check equality: $name.value === value */
  is(value: T): Expr
  /** Check inequality: $name.value !== value */
  isNot(value: T): Expr
  /** Check if value is one of multiple values: $name.value === v1 || $name.value === v2 || ... */
  oneOf(values: T[]): Expr
  /** Check if value is none of multiple values: $name.value !== v1 && $name.value !== v2 && ... */
  noneOf(values: T[]): Expr
  /** Create patch object for patchSignals */
  patch(value: T): Record<string, T>
}

export interface StringSignalHandle<T extends string = string> extends SignalHandle<T> {
  isEmpty(): Expr
  isNotEmpty(): Expr
  /** Check if value is one of multiple values */
  oneOf(values: T[]): Expr
  /** Check if value is none of multiple values */
  noneOf(values: T[]): Expr
}

export interface BooleanSignalHandle extends SignalHandle<boolean> {
  toggle(): Expr
  setTrue(): Expr
  setFalse(): Expr
}

export interface NumberSignalHandle extends SignalHandle<number> {
  gt(n: number): Expr
  gte(n: number): Expr
  lt(n: number): Expr
  lte(n: number): Expr
  /** Check if value is one of multiple values */
  oneOf(values: number[]): Expr
  /** Check if value is none of multiple values */
  noneOf(values: number[]): Expr
}

export interface NullableSignalHandle<T> extends SignalHandle<T | null> {
  clear(): Expr
  isNull(): Expr
  isNotNull(): Expr
}

function toLiteral(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "string") return `'${value.replace(/'/g, "\\'")}'`
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function createSignalHandle<T>(name: string, defaultValue: T): SignalHandle<T> {
  const signalExpr = `$${name}.value`

  return {
    name,
    defaultValue,
    expr: new Expr(signalExpr),
    set: (value: T) => new Expr(`$${name}.value = ${toLiteral(value)}`),
    is: (value: T) => new Expr(`$${name}.value === ${toLiteral(value)}`),
    isNot: (value: T) => new Expr(`$${name}.value !== ${toLiteral(value)}`),
    oneOf: (values: T[]) => {
      const conditions = values.map(v => `$${name}.value === ${toLiteral(v)}`).join(" || ")
      return new Expr(`(${conditions})`)
    },
    noneOf: (values: T[]) => {
      const conditions = values.map(v => `$${name}.value !== ${toLiteral(v)}`).join(" && ")
      return new Expr(`(${conditions})`)
    },
    patch: (value: T) => ({ [name]: value }),
  }
}

/**
 * Type helper for inferring signal handle type from default value.
 * Handles nullable types (string | null) by checking if null extends the type.
 * Uses [T] extends [...] to prevent distribution over union types.
 */
type InferSignalHandle<T> =
  // If T includes null (e.g., string | null, number | null), use NullableSignalHandle
  null extends T ? NullableSignalHandle<NonNullable<T>>
  : [T] extends [boolean] ? BooleanSignalHandle
  : [T] extends [number] ? NumberSignalHandle
  : [T] extends [string] ? StringSignalHandle<T>
  : SignalHandle<T>

/**
 * Create a universal signal handle that has ALL methods from all signal types.
 * TypeScript's type system restricts which methods are visible based on the Signals type,
 * but at runtime all methods exist so they work regardless of when the handle is accessed.
 */
function createUniversalSignalHandle(name: string): unknown {
  const signalExpr = `$${name}.value`

  return {
    name,
    defaultValue: undefined,
    expr: new Expr(signalExpr),
    set: (value: unknown) => new Expr(`$${name}.value = ${toLiteral(value)}`),
    is: (value: unknown) => new Expr(`$${name}.value === ${toLiteral(value)}`),
    isNot: (value: unknown) => new Expr(`$${name}.value !== ${toLiteral(value)}`),
    // Multi-value helpers
    oneOf: (values: unknown[]) => {
      const conditions = values.map(v => `$${name}.value === ${toLiteral(v)}`).join(" || ")
      return new Expr(`(${conditions})`)
    },
    noneOf: (values: unknown[]) => {
      const conditions = values.map(v => `$${name}.value !== ${toLiteral(v)}`).join(" && ")
      return new Expr(`(${conditions})`)
    },
    patch: (value: unknown) => ({ [name]: value }),
    // String methods
    isEmpty: () => new Expr(`$${name}.value === ''`),
    isNotEmpty: () => new Expr(`$${name}.value !== ''`),
    // Boolean methods
    toggle: () => new Expr(`$${name}.value = !$${name}.value`),
    setTrue: () => new Expr(`$${name}.value = true`),
    setFalse: () => new Expr(`$${name}.value = false`),
    // Number methods
    gt: (n: number) => new Expr(`$${name}.value > ${n}`),
    gte: (n: number) => new Expr(`$${name}.value >= ${n}`),
    lt: (n: number) => new Expr(`$${name}.value < ${n}`),
    lte: (n: number) => new Expr(`$${name}.value <= ${n}`),
    // Nullable methods
    clear: () => new Expr(`$${name}.value = null`),
    isNull: () => new Expr(`$${name}.value === null`),
    isNotNull: () => new Expr(`$${name}.value !== null`),
  }
}

import {
  type TriggerConfig,
  type UserTriggerConfig,
  type TriggerContext,
  type UserTriggerContext,
  type TriggerChange,
  type UserTriggerChange,
  type TriggerHandle,
  TriggerRegistry,
} from "./triggers"

// ============================================================================
// Request Schemas
// ============================================================================

const ActionRequestSchema = Schema.Struct({
  actionId: Schema.String,
  args: Schema.Unknown,
  signals: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  ),
})

// ============================================================================
// Config Types
// ============================================================================

/**
 * Repeat configuration (replaces timer + interval).
 * Use for game loops, heartbeats, polling, animations.
 */
export interface RepeatConfig<S extends object> {
  /** Duration: ms number (16) or duration string ("5 seconds") */
  readonly every: string | number
  /** Optional: only run when condition is true */
  readonly when?: (s: S) => boolean
  /** Optional: enable FPS tracking (ctx.fps available in handler) */
  readonly trackFps?: boolean
  readonly handler: (ctx: RepeatHandlerContext<S>) => void
}

export interface RepeatHandlerContext<S extends object> {
  readonly update: (fn: (s: S) => S) => void
  readonly getStore: () => S
  /** FPS value (0 if trackFps not enabled) */
  readonly fps: number
  /** Broadcast SSE event to all clients */
  readonly broadcast: (event: SSEEventTyped) => void
}

export interface RepeatHandle {
  readonly id: string
  start(): void
  stop(): void
  readonly isRunning: boolean
}

/**
 * Cron configuration (calendar-based scheduling).
 */
export interface CronConfig<S extends object, U extends object = object> {
  /** Cron expression ("0 * * * *") or duration string ("5 minutes") */
  readonly every: string
  readonly handler?: (ctx: CronHandlerContext<S>) => void
  readonly forEachUser?: (ctx: CronUserContext<S, U>) => void
}

export interface CronHandlerContext<S extends object> {
  readonly update: (fn: (s: S) => S) => void
  readonly getStore: () => S
}

export interface CronUserContext<S extends object, U extends object> {
  readonly update: (fn: (s: S) => S) => void
  readonly getStore: () => S
  readonly updateUser: (fn: (u: U) => U) => void
  readonly getUserStore: () => U
  readonly sessionId: string
}

export interface CronHandle {
  readonly id: string
  pause(): void
  resume(): void
  trigger(): void
  readonly isPaused: boolean
}

// ============================================================================
// App Configuration (passed to .app())
// ============================================================================

export interface HyperstarConfig<S extends object, U extends object, Signals extends object = Record<string, unknown>> {
  readonly store: S
  readonly userStore?: U
  /** Default signal values - like store, these are the initial values for client-side signals */
  readonly signals?: { [K in keyof Signals]: Signals[K] }
  /** View function - returns JSX (string or Promise<string>) */
  readonly view: (ctx: ViewContext<S, U>) => string | Promise<string>
  /** Page title - string or derived function */
  readonly title?: string | ((ctx: { store: S; userStore: U }) => string)
  /** Favicon - string path or derived function */
  readonly favicon?: string | ((ctx: { store: S; userStore: U }) => string)
  readonly persist?: string | { path: string; debounceMs?: number }
  /**
   * Auto-pause background tasks when no clients are connected.
   * Allows Sprites to hibernate and reduce billing.
   * @default true
   */
  readonly autoPauseWhenIdle?: boolean
  readonly onStart?: (ctx: LifecycleContext<S>) => void
  readonly onConnect?: (ctx: { session: Session; store: S; update: (fn: (s: S) => S) => void }) => void
  readonly onDisconnect?: (ctx: { session: Session; store: S; update: (fn: (s: S) => S) => void }) => void
}

export interface ViewContext<S extends object, U extends object> {
  readonly store: Readonly<S>
  readonly userStore: Readonly<U>
  readonly session: Session
}

export interface ServeOptions {
  readonly port?: number
  readonly hostname?: string
}

// ============================================================================
// Factory Interface (returned by createHyperstar)
// ============================================================================

export interface HyperstarFactory<
  S extends object,
  U extends object = object,
  Signals extends object = Record<string, unknown>,
> {
  /**
   * Signal handles derived from Signals type parameter.
   * Access typed signal handles for use in views.
   *
   * @example
   * interface Signals { text: string; editingId: number | null }
   * const hs = createHyperstar<Store, {}, Signals>()
   * const { text, editingId } = hs.signals
   */
  readonly signals: { [K in keyof Signals]: InferSignalHandle<Signals[K]> }

  /**
   * Define an action with no arguments.
   */
  action(
    id: string,
    handler: (ctx: SimplifiedActionContext<S, U, Signals>) => void | Promise<void>,
  ): ActionDescriptor<void, void, S, U>

  /**
   * Define an action with schema-validated arguments.
   */
  action<Args extends Record<string, Schema.Schema.Any>>(
    id: string,
    args: Args,
    handler: (
      ctx: SimplifiedActionContext<S, U, Signals>,
      args: { [K in keyof Args]: Schema.Schema.Type<Args[K]> },
    ) => void | Promise<void>,
  ): ActionDescriptor<{ [K in keyof Args]: Schema.Schema.Type<Args[K]> }, void, S, U>

  /**
   * Define a repeating task (replaces timer/interval).
   * Use for heartbeats, polling, game loops, animations.
   */
  repeat(id: string, config: RepeatConfig<S>): void

  /**
   * Define a cron job (calendar-based scheduling).
   * Supports cron expressions and duration strings.
   */
  cron(id: string, config: CronConfig<S, U>): void

  /**
   * Define a trigger that watches store changes.
   */
  trigger<T = S>(id: string, config: {
    watch?: (s: S) => T
    handler: (ctx: TriggerContext<S>, change: TriggerChange<T>) => void
  }): void

  /**
   * Define a trigger that watches per-user store changes.
   */
  userTrigger<T = U>(id: string, config: {
    watch?: (u: U) => T
    handler: (ctx: UserTriggerContext<S, U>, change: UserTriggerChange<T>) => void
  }): void

  /**
   * Configure the app with store, view, and other options.
   * Returns a servable app.
   */
  app(config: HyperstarConfig<S, U, Signals>): HyperstarApp
}

export interface HyperstarApp {
  serve(options?: ServeOptions): { port: number; stop: () => Promise<void> }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a schedule string to an Effect Schedule.
 * Supports duration strings ("5 minutes") and cron expressions ("0 * * * *").
 */
function parseScheduleString(input: string): Schedule.Schedule<unknown> {
  // Try duration first (e.g., "5 seconds", "1 minute")
  const durationResult = Either.try(() => Duration.decode(input as Duration.DurationInput))
  if (Either.isRight(durationResult)) {
    return Schedule.spaced(durationResult.right)
  }

  // Try cron expression (e.g., "0 * * * *")
  const cronResult = Cron.parse(input)
  if (Either.isRight(cronResult)) {
    return Schedule.cron(cronResult.right)
  }

  // Fallback
  console.warn(`Unknown schedule "${input}", defaulting to hourly`)
  return Schedule.spaced(Duration.hours(1))
}

// ============================================================================
// Factory Implementation
// ============================================================================

/**
 * Create a Hyperstar factory.
 *
 * @example Basic usage:
 * ```typescript
 * const hs = createHyperstar<Store>()
 * ```
 *
 * @example With signal types (type-safe patchSignals):
 * ```typescript
 * interface Signals { text: string; count: number }
 * const hs = createHyperstar<Store, {}, Signals>()
 * const { text, count } = hs.signals
 *
 * // Provide default values in app()
 * hs.app({
 *   store: { items: [] },
 *   signals: { text: "", count: 0 },
 *   view: ...
 * })
 * ```
 */
export const createHyperstar = <
  S extends object,
  U extends object = Record<string, never>,
  Signals extends object = Record<string, unknown>,
>(): HyperstarFactory<S, U, Signals> => {
  // Pre-registered definitions (before app() is called)
  const actionDefs = new Map<string, ActionDescriptor>()
  const repeatDefs: Array<{ id: string; config: RepeatConfig<S> }> = []
  const cronDefs: Array<{ id: string; config: CronConfig<S, U> }> = []
  const triggerDefs: Array<{ id: string; config: Omit<TriggerConfig<S, unknown>, "id"> }> = []
  const userTriggerDefs: Array<{ id: string; config: Omit<UserTriggerConfig<S, U, unknown>, "id"> }> = []

  // Create signal handles lazily via Proxy - handles are created on first access
  // Uses universal handles with all methods; TypeScript restricts visibility based on Signals type
  const signalHandlesCache = new Map<string, unknown>()
  const signalHandles = new Proxy({} as { [K in keyof Signals]: InferSignalHandle<Signals[K]> }, {
    get(_, prop: string) {
      if (!signalHandlesCache.has(prop)) {
        // Create universal handle with all methods - type system restricts which are visible
        signalHandlesCache.set(prop, createUniversalSignalHandle(prop))
      }
      return signalHandlesCache.get(prop)
    },
    ownKeys() {
      return Array.from(signalHandlesCache.keys())
    },
    getOwnPropertyDescriptor(_, prop: string) {
      if (signalHandlesCache.has(prop)) {
        return { enumerable: true, configurable: true }
      }
      return undefined
    }
  })

  const factory: HyperstarFactory<S, U, Signals> = {
    signals: signalHandles,

    action(
      id: string,
      handlerOrArgs:
        | ((ctx: SimplifiedActionContext<S, U>) => void | Promise<void>)
        | Record<string, Schema.Schema.Any>,
      handler?: (ctx: SimplifiedActionContext<S, U>, args: any) => void | Promise<void>,
    ): any {
      let action: ActionDescriptor

      if (typeof handlerOrArgs === "function") {
        action = createNoArgsAction<S, U>(id, handlerOrArgs) as ActionDescriptor
      } else if (handler !== undefined) {
        action = createWithArgsAction(id, handlerOrArgs, handler) as ActionDescriptor
      } else {
        throw new Error(`Invalid action call for "${id}"`)
      }

      actionDefs.set(id, action)
      return action
    },

    repeat(id: string, config: RepeatConfig<S>): void {
      repeatDefs.push({ id, config })
    },

    cron(id: string, config: CronConfig<S, U>): void {
      cronDefs.push({ id, config })
    },

    trigger<T = S>(id: string, config: {
      watch?: (s: S) => T
      handler: (ctx: TriggerContext<S>, change: TriggerChange<T>) => void
    }): void {
      triggerDefs.push({ id, config: config as TriggerConfig<S, unknown> })
    },

    userTrigger<T = U>(id: string, config: {
      watch?: (u: U) => T
      handler: (ctx: UserTriggerContext<S, U>, change: UserTriggerChange<T>) => void
    }): void {
      userTriggerDefs.push({ id, config: config as UserTriggerConfig<S, U, unknown> })
    },

    app(config: HyperstarConfig<S, U, Signals>): HyperstarApp {
      // Signal defaults from config
      const signalDefaults: Record<string, unknown> = config.signals ?? {}

      // Runtime state
      let storeRef: SubscriptionRef.SubscriptionRef<S>
      const sseClients = new Map<string, { controller: ReadableStreamDefaultController; session: Session; connectionId: string }>()
      const signalState = new Map<string, Record<string, unknown>>()
      const userStores = new Map<string, U>()
      const defaultUserStore = config.userStore ?? ({} as U)

      // Idle state tracking for auto-pause
      let isIdle = true  // Start idle (no clients yet)

      // Forward declarations for pause/resume functions (defined after startScheduledTasks)
      let pauseBackgroundTasks: () => void
      let resumeBackgroundTasks: () => void

      const checkIdleState = () => {
        const autoPause = config.autoPauseWhenIdle ?? true
        if (!autoPause) return

        const wasIdle = isIdle
        isIdle = sseClients.size === 0

        if (wasIdle !== isIdle) {
          if (isIdle) {
            console.log('🌙 No active clients - pausing background tasks for hibernation')
            pauseBackgroundTasks()
          } else {
            console.log('☀️  Client connected - resuming background tasks')
            resumeBackgroundTasks()
          }
        }
      }

      // Handles for cleanup
      const repeatHandles = new Map<string, RepeatHandle>()
      const cronHandles = new Map<string, CronHandle>()
      let triggerRegistry: TriggerRegistry<S, U> | null = null

      // Persistence
      const persistConfig = config.persist
        ? typeof config.persist === "string"
          ? { path: config.persist, debounceMs: 100 }
          : { path: config.persist.path, debounceMs: config.persist.debounceMs ?? 100 }
        : null

      const loadPersistedStore = (): S => {
        if (!persistConfig) return config.store

        const result = Either.try(() => {
          if (!fs.existsSync(persistConfig.path)) return config.store
          const data = fs.readFileSync(persistConfig.path, "utf-8")
          const json = JSON.parse(data)
          return { ...config.store, ...json }
        })

        if (Either.isLeft(result)) {
          console.warn(`⚠️  Failed to load persisted store: ${result.left}`)
          return config.store
        }

        console.log(`📂 Loaded store from ${persistConfig.path}`)
        return result.right
      }

      const saveStoreToFile = (store: S) => {
        if (!persistConfig) return
        try {
          const dir = path.dirname(persistConfig.path)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          fs.writeFileSync(persistConfig.path, JSON.stringify(store, null, 2))
        } catch (error) {
          console.error(`❌ Failed to save store: ${error}`)
        }
      }

      // Initialize store
      const initStore = Effect.gen(function* () {
        const initialStore = loadPersistedStore()
        storeRef = yield* SubscriptionRef.make(initialStore)
        return storeRef
      })

      let storeInitialized = false
      const ensureStoreInitialized = () => {
        if (!storeInitialized) {
          Effect.runSync(initStore)
          storeInitialized = true
        }
      }

      const getStore = () => Effect.runSync(SubscriptionRef.get(storeRef))
      const updateStoreBase = (fn: (s: S) => S) => Effect.runSync(SubscriptionRef.update(storeRef, fn))

      const updateStore = (fn: (s: S) => S) => {
        const oldStore = getStore()
        updateStoreBase(fn)
        const newStore = getStore()
        if (triggerRegistry) {
          triggerRegistry.onStoreUpdate(oldStore, newStore)
        }
      }

      const getUserStore = (session: Session): U => {
        const key = session.id
        if (!userStores.has(key)) {
          userStores.set(key, { ...defaultUserStore })
        }
        return userStores.get(key)!
      }

      const getUserStoreById = (sessionId: string): U | undefined => userStores.get(sessionId)

      const updateUserStore = (session: Session, fn: (u: U) => U) => {
        const key = session.id
        const oldUserStore = getUserStore(session)
        const newUserStore = fn(oldUserStore)
        userStores.set(key, newUserStore)
        if (triggerRegistry) {
          triggerRegistry.onUserStoreUpdate(key, oldUserStore, newUserStore)
        }
        // Broadcast re-render to this user's clients (fire-and-forget)
        broadcastToSession(key).catch(() => {})
      }

      const updateUserStoreById = (sessionId: string, fn: (u: U) => U) => {
        const current = userStores.get(sessionId)
        if (current) {
          const newUserStore = fn(current)
          userStores.set(sessionId, newUserStore)
          if (triggerRegistry) {
            triggerRegistry.onUserStoreUpdate(sessionId, current, newUserStore)
          }
          // Broadcast re-render to this user's clients (fire-and-forget)
          broadcastToSession(sessionId).catch(() => {})
        }
      }

      const getAllUserStores = (): Map<string, U> => userStores

      const cleanupSession = (sessionId: string) => {
        userStores.delete(sessionId)
        signalState.delete(sessionId)
      }

      const broadcast = (event: SSEEventTyped) => {
        const data = JSON.stringify(event.data)
        const message = `event: ${event.type}\ndata: ${data}\n\n`
        for (const [, client] of sseClients) {
          try {
            client.controller.enqueue(new TextEncoder().encode(message))
          } catch {
            // Client disconnected
          }
        }
      }

      // Send to all clients connected with a specific session ID
      const sendToSession = (sessionId: string, event: SSEEventTyped) => {
        const data = JSON.stringify(event.data)
        const message = `event: ${event.type}\ndata: ${data}\n\n`
        for (const [, client] of sseClients) {
          if (client.session.id === sessionId) {
            try {
              client.controller.enqueue(new TextEncoder().encode(message))
            } catch {
              // Client disconnected
            }
          }
        }
      }

      // Re-render and send to a specific session (used for user store updates)
      const broadcastToSession = async (sessionId: string) => {
        const session = { id: sessionId } as Session
        const html = await renderView(session)
        const morphEvent = SSE.morph(html, "app")
        sendToSession(sessionId, morphEvent)

        // Also send title/favicon if dynamic
        const store = getStore()
        const userStore = getUserStore(session)
        if (typeof config.title === "function") {
          const titleEvent = SSE.title(config.title({ store, userStore }))
          sendToSession(sessionId, titleEvent)
        }
        if (typeof config.favicon === "function") {
          const newFavicon = config.favicon({ store, userStore })
          if (newFavicon) sendToSession(sessionId, SSE.favicon(newFavicon))
        }
      }

      const renderView = async (session: Session): Promise<string> => {
        const store = getStore()
        const userStore = getUserStore(session)
        const ctx: ViewContext<S, U> = {
          store,
          userStore,
          session,
        }
        const result = config.view(ctx)
        if (typeof result === "string") {
          return result
        }
        return await result
      }

      const computeTitle = (store: S, userStore: U): string => {
        if (!config.title) return "Hyperstar App"
        if (typeof config.title === "string") return config.title
        return config.title({ store, userStore })
      }

      const computeFavicon = (store: S, userStore: U): string | null => {
        if (!config.favicon) return null
        if (typeof config.favicon === "string") return config.favicon
        return config.favicon({ store, userStore })
      }

      const renderFullDocument = async (session: Session): Promise<string> => {
        const store = getStore()
        const userStore = getUserStore(session)
        const title = computeTitle(store, userStore)
        const faviconStr = computeFavicon(store, userStore)

        const ctx: ViewContext<S, U> = {
          store,
          userStore,
          session,
        }

        const viewResult = config.view(ctx)
        const body = typeof viewResult === "string" ? viewResult : await viewResult

        // Escape signal defaults for JSON attribute
        const signalsJson = JSON.stringify(signalDefaults).replace(/"/g, "&quot;")

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>${faviconStr ? `\n  <link rel="icon" href="${faviconStr}">` : ""}
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body hs-signals="${signalsJson}" hs-init="Hyperstar.setSessionId('${session.id}'); Hyperstar.connect('/hs/sse')">
  <div id="app">${body}</div>
  <script type="module" src="/hs/client.js"></script>
</body>
</html>`
      }

      const handleRequest = async (req: Request): Promise<Response> => {
        const url = new URL(req.url)
        const reqPath = url.pathname

        const cookies = req.headers.get("cookie") ?? ""
        let sessionId = cookies.split(";").find((c) => c.trim().startsWith("hs_session="))?.split("=")[1]
        if (!sessionId) sessionId = crypto.randomUUID()

        const session: Session = { id: sessionId, userId: null, connectedAt: new Date() }

        if (reqPath === "/") {
          const html = await renderFullDocument(session)
          return new Response(html, {
            headers: {
              "Content-Type": "text/html",
              "Set-Cookie": `hs_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
            },
          })
        }

        if (reqPath === "/hs/sse") {
          const connectionId = crypto.randomUUID()
          console.log(`[hyperstar] SSE connect: session=${sessionId.slice(0, 8)}... conn=${connectionId.slice(0, 8)}...`)
          const stream = new ReadableStream({
            start(controller) {
              sseClients.set(connectionId, { controller, session, connectionId })
              console.log(`[hyperstar] SSE client registered. Total clients: ${sseClients.size}`)
              checkIdleState()  // Check if we went from idle to active
              config.onConnect?.({ session, store: getStore(), update: updateStore })
              controller.enqueue(new TextEncoder().encode(": connected\n\n"))
            },
            cancel() {
              console.log(`[hyperstar] SSE disconnect: conn=${connectionId.slice(0, 8)}...`)
              sseClients.delete(connectionId)
              console.log(`[hyperstar] SSE client removed. Total clients: ${sseClients.size}`)
              // Only cleanup session if this was the last connection for this session
              const hasOtherConnections = Array.from(sseClients.values()).some(c => c.session.id === session.id)
              if (!hasOtherConnections) {
                cleanupSession(session.id)
              }
              config.onDisconnect?.({ session, store: getStore(), update: updateStore })
              checkIdleState()  // Check if we went from active to idle
            },
          })
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
          })
        }

        if (reqPath === "/hs/client.js") {
          const bundle = await getClientBundle()
          return new Response(bundle, {
            headers: {
              "Content-Type": "application/javascript",
              "Cache-Control": "no-cache", // Don't cache during development
            },
          })
        }

        if (reqPath === "/hs/action" && req.method === "POST") {
          try {
            const parseResult = Schema.decodeUnknownEither(ActionRequestSchema)(await req.json())
            if (Either.isLeft(parseResult)) {
              return new Response(
                JSON.stringify({ error: "Invalid request body" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              )
            }
            const { actionId, args, signals } = parseResult.right

            signalState.set(sessionId, signals ?? {})

            // Merge signals into args - allows form/bind pattern where
            // inputs bound to signals automatically become action args
            const mergedArgs = { ...(signals ?? {}), ...(args ?? {}) }

            const action = actionDefs.get(actionId)
            if (!action) {
              return new Response(JSON.stringify({ error: "Action not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
              })
            }

            const actionCtx = {
              session,
              store: {
                get: Effect.sync(() => getStore()),
                update: (fn: (s: S) => S) => Effect.sync(() => updateStore(fn)),
                set: (s: S) => Effect.sync(() => updateStore(() => s)),
                changes: Stream.empty,
                ref: storeRef,
              },
              userStore: {
                get: Effect.sync(() => getUserStore(session)),
                update: (fn: (u: U) => U) => Effect.sync(() => updateUserStore(session, fn)),
                getForUser: (userId: string) =>
                  Effect.sync(() => {
                    if (!userStores.has(userId)) userStores.set(userId, { ...defaultUserStore })
                    return userStores.get(userId)!
                  }),
                updateForUser: (userId: string, fn: (u: U) => U) =>
                  Effect.sync(() => {
                    if (!userStores.has(userId)) userStores.set(userId, { ...defaultUserStore })
                    userStores.set(userId, fn(userStores.get(userId)!))
                  }),
              },
              sse: {
                broadcast: (event: SSEEventTyped) => Effect.sync(() => broadcast(event)),
                sendTo: () => Effect.void,
                sendToUser: () => Effect.void,
                connectionCount: Effect.succeed(sseClients.size),
                register: () => Effect.void,
                unregister: () => Effect.void,
                connections: Stream.empty,
              },
              signals: {
                patch: (patches: Record<string, unknown>) => Effect.sync(() => broadcast(SSE.signals(patches))),
                patchFor: () => Effect.void,
                get: (sid: string, name: string) => Effect.sync(() => signalState.get(sid)?.[name]),
              },
              head: {
                setTitle: (title: string) => Effect.sync(() => broadcast(SSE.title(title))),
                setFavicon: (href: string, type?: string) => Effect.sync(() => broadcast(SSE.favicon(href, type))),
              },
            }

            await Effect.runPromise(
              pipe(
                action.run(actionCtx as any, mergedArgs),
                Effect.catchAll((error) => {
                  console.error("Action error:", error)
                  return Effect.succeed(undefined)
                }),
              ),
            )

            // Broadcast is handled by storeRef.changes watcher (no need to broadcast here)
            // This prevents duplicate broadcasts when actions update the store

            return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } })
          } catch (error) {
            console.error("Action request error:", error)
            return new Response(JSON.stringify({ error: String(error) }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            })
          }
        }

        return new Response("Not Found", { status: 404 })
      }

      // Start repeats/crons
      const startScheduledTasks = (forkScoped: <A>(effect: Effect.Effect<A, never, never>) => void) => {
        // Repeats (unified timer + interval)
        for (const { id, config: repeatConfig } of repeatDefs) {
          const frameTimestamps: number[] = []
          let fiber: Fiber.RuntimeFiber<void, never> | null = null
          let pauseRef: Ref.Ref<boolean> | null = null
          let isRunning = false

          // Parse duration: "5 seconds" or 16 (ms)
          const duration = typeof repeatConfig.every === "number"
            ? Duration.millis(repeatConfig.every)
            : Duration.decode(repeatConfig.every as Duration.DurationInput)

          const calculateFps = (): number => {
            if (!repeatConfig.trackFps) return 0
            const now = Date.now()
            while (frameTimestamps.length > 0 && now - frameTimestamps[0]! > 1000) {
              frameTimestamps.shift()
            }
            return frameTimestamps.length
          }

          const startRepeat = () => {
            if (isRunning) return
            console.log(`🔄 [Repeat:${id}] Started (every: ${Duration.toMillis(duration)}ms)`)
            pauseRef = Effect.runSync(Ref.make(false))

            const runOnce = Effect.sync(() => {
              const paused = Effect.runSync(Ref.get(pauseRef!))
              if (paused) return
              if (repeatConfig.when && !repeatConfig.when(getStore())) return
              if (repeatConfig.trackFps) frameTimestamps.push(Date.now())
              repeatConfig.handler({
                update: updateStore,
                getStore,
                fps: calculateFps(),
                broadcast,
              })
            })

            // Use Schedule.fixed() for consistent intervals
            fiber = Effect.runFork(
              pipe(
                runOnce,
                Effect.repeat(Schedule.fixed(duration)),
                Effect.asVoid,
                Effect.catchAll(() => Effect.void)
              ),
            ) as Fiber.RuntimeFiber<void, never>
            isRunning = true
          }

          const handle: RepeatHandle = {
            id,
            get isRunning() { return isRunning },
            start() { startRepeat() },
            stop() {
              console.log(`🔄 [Repeat:${id}] Stopped`)
              if (pauseRef) Effect.runSync(Ref.set(pauseRef, true))
              if (fiber) { Effect.runFork(Fiber.interruptFork(fiber)); fiber = null }
              isRunning = false
            },
          }

          startRepeat()
          repeatHandles.set(id, handle)
        }

        // Crons
        for (const { id, config: cronConfig } of cronDefs) {
          const effectSchedule = parseScheduleString(cronConfig.every)
          const pauseRef = Effect.runSync(Ref.make(false))
          let isPaused = false

          const runOnce = Effect.sync(() => {
            const paused = Effect.runSync(Ref.get(pauseRef))
            if (paused) return

            if (cronConfig.handler) {
              console.log(`📅 [Cron:${id}] Running handler`)
              cronConfig.handler({ update: updateStore, getStore })
            }

            if (cronConfig.forEachUser) {
              const userStoresMap = getAllUserStores()
              console.log(`📅 [Cron:${id}] Running forEachUser (${userStoresMap.size} users)`)
              for (const [sessionIdKey, userStore] of userStoresMap) {
                cronConfig.forEachUser({
                  update: updateStore,
                  getStore,
                  updateUser: (fn) => updateUserStoreById(sessionIdKey, fn),
                  getUserStore: () => userStore,
                  sessionId: sessionIdKey,
                })
              }
            }
          })

          console.log(`📅 [Cron:${id}] Started (every: ${cronConfig.every})`)
          forkScoped(pipe(runOnce, Effect.repeat(effectSchedule), Effect.asVoid, Effect.catchAll(() => Effect.void)))

          const handle: CronHandle = {
            id,
            get isPaused() { return isPaused },
            pause() { console.log(`📅 [Cron:${id}] Paused`); Effect.runSync(Ref.set(pauseRef, true)); isPaused = true },
            resume() { console.log(`📅 [Cron:${id}] Resumed`); Effect.runSync(Ref.set(pauseRef, false)); isPaused = false },
            trigger() {
              console.log(`📅 [Cron:${id}] Manually triggered`)
              if (cronConfig.handler) cronConfig.handler({ update: updateStore, getStore })
              if (cronConfig.forEachUser) {
                for (const [sessionIdKey, userStore] of getAllUserStores()) {
                  cronConfig.forEachUser({
                    update: updateStore,
                    getStore,
                    updateUser: (fn) => updateUserStoreById(sessionIdKey, fn),
                    getUserStore: () => userStore,
                    sessionId: sessionIdKey,
                  })
                }
              }
            },
          }
          cronHandles.set(id, handle)
        }
      }

      // Implement pause/resume functions for idle detection
      pauseBackgroundTasks = () => {
        for (const repeat of repeatHandles.values()) {
          if (repeat.isRunning) repeat.stop()
        }
        for (const cron of cronHandles.values()) {
          if (!cron.isPaused) cron.pause()
        }
      }

      resumeBackgroundTasks = () => {
        for (const repeat of repeatHandles.values()) {
          if (!repeat.isRunning) repeat.start()
        }
        for (const cron of cronHandles.values()) {
          if (cron.isPaused) cron.resume()
        }
      }

      return {
        serve(options = {}) {
          const port = options.port ?? 3000
          const hostname = options.hostname ?? "0.0.0.0"

          ensureStoreInitialized()

          // Create scope for all background fibers
          const appScope = Effect.runSync(Scope.make())

          // Helper to fork into the app scope
          const forkScoped = <A>(effect: Effect.Effect<A, never, never>) => {
            const program = pipe(
              effect,
              Effect.forkScoped,
              Effect.provideService(Scope.Scope, appScope)
            )
            Effect.runFork(program)
          }

          // Initialize trigger registry
          triggerRegistry = new TriggerRegistry<S, U>(getStore, updateStore, getUserStoreById, updateUserStoreById)

          // Register triggers
          for (const { id, config: triggerConfig } of triggerDefs) {
            triggerRegistry.registerTrigger({ id, ...triggerConfig })
          }
          for (const { id, config: userTriggerConfig } of userTriggerDefs) {
            triggerRegistry.registerUserTrigger({ id, ...userTriggerConfig })
          }

          // Lifecycle
          const { context: lifecycleCtx, cleanup: lifecycleCleanup } = createLifecycleContext(getStore, updateStore)
          config.onStart?.(lifecycleCtx)

          // Store change broadcasting
          forkScoped(
            pipe(
              storeRef.changes,
              Stream.tap((store) =>
                Effect.promise(async () => {
                  for (const [, client] of sseClients) {
                    const userStore = getUserStore(client.session)
                    const html = await renderView(client.session)

                    // Send morph event for view update
                    const morphEvent = SSE.morph(html, "app")
                    const morphMessage = `event: ${morphEvent.type}\ndata: ${JSON.stringify(morphEvent.data)}\n\n`

                    // Send title update if title is dynamic
                    let titleMessage = ""
                    if (typeof config.title === "function") {
                      const newTitle = config.title({ store, userStore })
                      const titleEvent = SSE.title(newTitle)
                      titleMessage = `event: ${titleEvent.type}\ndata: ${JSON.stringify(titleEvent.data)}\n\n`
                    }

                    // Send favicon update if favicon is dynamic
                    let faviconMessage = ""
                    if (typeof config.favicon === "function") {
                      const newFavicon = config.favicon({ store, userStore })
                      if (newFavicon) {
                        const faviconEvent = SSE.favicon(newFavicon)
                        faviconMessage = `event: ${faviconEvent.type}\ndata: ${JSON.stringify(faviconEvent.data)}\n\n`
                      }
                    }

                    try {
                      client.controller.enqueue(new TextEncoder().encode(morphMessage + titleMessage + faviconMessage))
                    } catch {}
                  }
                }),
              ),
              Stream.runDrain,
            ),
          )

          // Persist store changes
          if (persistConfig) {
            forkScoped(
              pipe(
                storeRef.changes,
                Stream.debounce(Duration.millis(persistConfig.debounceMs)),
                Stream.tap((store) => Effect.sync(() => saveStoreToFile(store))),
                Stream.runDrain,
              ),
            )
          }

          // Start scheduled tasks
          startScheduledTasks(forkScoped)

          // SSE heartbeat - send a comment every 30 seconds to keep connections alive
          forkScoped(
            pipe(
              Stream.repeatEffect(Effect.sleep(Duration.seconds(30))),
              Stream.tap(() =>
                Effect.sync(() => {
                  const heartbeat = `: heartbeat ${Date.now()}\n\n`
                  for (const [, client] of sseClients) {
                    try {
                      client.controller.enqueue(new TextEncoder().encode(heartbeat))
                    } catch {}
                  }
                }),
              ),
              Stream.runDrain,
            ),
          )

          const server = Bun.serve({
            port,
            hostname,
            fetch: handleRequest,
            idleTimeout: 255, // Max value (255 seconds) - SSE needs long-lived connections
          })
          const actualPort = server.port ?? port
          console.log(`🌟 Hyperstar running at http://localhost:${actualPort}`)

          // Handle graceful shutdown signals (for Sprites hibernation, Ctrl+C, etc.)
          const app = {
            port: actualPort,
            stop: async () => {
              console.log("🧹 Cleaning up and shutting down...")

              // Stop repeats (these use their own fibers with pauseRef)
              for (const repeat of repeatHandles.values()) repeat.stop()
              repeatHandles.clear()
              for (const cron of cronHandles.values()) cron.pause()
              cronHandles.clear()

              // Flush persistence before closing scope
              if (persistConfig) saveStoreToFile(getStore())

              // Close scope - interrupts all scoped fibers (crons, broadcast, persist)
              await Effect.runPromise(Scope.close(appScope, Exit.void))

              if (triggerRegistry) triggerRegistry.clear()
              lifecycleCleanup()
              return server.stop()
            },
          }

          const shutdown = async () => {
            await app.stop()
            process.exit(0)
          }

          process.on("SIGTERM", shutdown)
          process.on("SIGINT", shutdown)

          return app
        },
      }
    },
  }

  return factory
}

/**
 * Legacy API: createServer with config.
 * Use createHyperstar() factory for new code.
 */
export const createServer = createHyperstar
