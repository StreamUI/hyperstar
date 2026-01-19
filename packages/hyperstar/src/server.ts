/**
 * Hyperstar v3 - Factory Pattern Server
 *
 * Two-phase setup: define actions first, then configure app with view.
 * This allows views to reference action variables directly.
 *
 * @example
 * const hs = createHyperstar<Store, UserStore>()
 *
 * // Define actions first
 * const increment = hs.action("increment", (ctx) => {
 *   ctx.update(s => ({ ...s, count: s.count + 1 }))
 * })
 *
 * // Configure app with view that references actions
 * hs.app({
 *   store: { count: 0 },
 *   view: (ctx) => UI.button({ events: { click: on.action(increment) } }, "+1")
 * }).serve({ port: 3000 })
 */
import { Effect, SubscriptionRef, Stream, pipe, Schedule, Ref, Fiber, Cron, Duration, Either, Scope, Exit } from "effect"
import * as fs from "node:fs"
import * as path from "node:path"
import { type Session, SSE, type SSEEventTyped } from "./core/services"
import {
  type ActionDescriptor,
  type SimplifiedActionContext,
  createNoArgsAction,
  createWithArgsAction,
} from "./action/schema"
import { Schema } from "effect"
import { type UINode, render } from "./ui"
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
  /** Create patch object for patchSignals */
  patch(value: T): Record<string, T>
}

export interface StringSignalHandle<T extends string = string> extends SignalHandle<T> {
  isEmpty(): Expr
  isNotEmpty(): Expr
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
 * Timer configuration (game loops, high-frequency updates).
 */
export interface TimerConfig<S extends object> {
  readonly interval: number
  readonly when?: (s: S) => boolean
  readonly trackFps?: boolean
  readonly handler: (ctx: TimerHandlerContext<S>) => void
}

export interface TimerHandlerContext<S extends object> {
  readonly update: (fn: (s: S) => S) => void
  readonly getStore: () => S
  readonly fps: number
}

export interface TimerHandle {
  readonly id: string
  start(): void
  stop(): void
  readonly isRunning: boolean
}

/**
 * Interval configuration (simple repeating tasks).
 */
export interface IntervalConfig<S extends object> {
  readonly every: string | number
  readonly handler: (ctx: IntervalHandlerContext<S>) => void
}

export interface IntervalHandlerContext<S extends object> {
  readonly update: (fn: (s: S) => S) => void
  readonly getStore: () => S
}

export interface IntervalHandle {
  readonly id: string
  start(): void
  stop(): void
  readonly isRunning: boolean
}

/**
 * Cron configuration (scheduled jobs).
 */
export interface CronConfig<S extends object, U extends object = object> {
  /** Schedule - cron expression ("0 * * * *") or duration string ("5 minutes") */
  readonly schedule: string
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
  readonly view: (ctx: ViewContext<S, U>) => UINode
  /** Page title - string or derived function */
  readonly title?: string | ((ctx: { store: S; userStore: U }) => string)
  /** Favicon - string path or derived function */
  readonly favicon?: string | ((ctx: { store: S; userStore: U }) => string)
  readonly persist?: string | { path: string; debounceMs?: number }
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
   * Define a timer (game loops, high-frequency updates).
   */
  timer(id: string, config: TimerConfig<S>): void

  /**
   * Define a simple repeating interval.
   */
  interval(id: string, config: IntervalConfig<S>): void

  /**
   * Define a scheduled cron job.
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
  const timerDefs: Array<{ id: string; config: TimerConfig<S> }> = []
  const intervalDefs: Array<{ id: string; config: IntervalConfig<S> }> = []
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

    timer(id: string, config: TimerConfig<S>): void {
      timerDefs.push({ id, config })
    },

    interval(id: string, config: IntervalConfig<S>): void {
      intervalDefs.push({ id, config })
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
      const sseClients = new Map<string, { controller: ReadableStreamDefaultController; session: Session }>()
      const signalState = new Map<string, Record<string, unknown>>()
      const userStores = new Map<string, U>()
      const defaultUserStore = config.userStore ?? ({} as U)

      // Handles for cleanup
      const timerHandles = new Map<string, TimerHandle>()
      const intervalHandles = new Map<string, IntervalHandle>()
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
      }

      const updateUserStoreById = (sessionId: string, fn: (u: U) => U) => {
        const current = userStores.get(sessionId)
        if (current) {
          const newUserStore = fn(current)
          userStores.set(sessionId, newUserStore)
          if (triggerRegistry) {
            triggerRegistry.onUserStoreUpdate(sessionId, current, newUserStore)
          }
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

      const renderView = (session: Session): string => {
        const store = getStore()
        const userStore = getUserStore(session)
        const ctx: ViewContext<S, U> = {
          store,
          userStore,
          session,
        }
        return render(config.view(ctx))
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

      const renderFullDocument = (session: Session): string => {
        const store = getStore()
        const userStore = getUserStore(session)
        const title = computeTitle(store, userStore)
        const faviconStr = computeFavicon(store, userStore)

        const ctx: ViewContext<S, U> = {
          store,
          userStore,
          session,
        }

        const body = render(config.view(ctx))
        const signalInit = Object.entries(signalDefaults)
          .map(([name, value]) => `const $${name} = signal(${JSON.stringify(value)}); window.$${name} = $${name};`)
          .join("\n")

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>${faviconStr ? `\n  <link rel="icon" href="${faviconStr}">` : ""}
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="app">${body}</div>
  <script type="module">
    import { signal, effect } from "https://esm.sh/@preact/signals-core@1.8.0";
    import { Idiomorph } from "https://esm.sh/idiomorph@0.7.4";

    ${signalInit}

    const Hyperstar = {
      sessionId: "${session.id}",
      async dispatch(mode, actionId, args) {
        const signalValues = {
          ${Object.keys(signalDefaults)
            .map((name) => `${name}: $${name}.value`)
            .join(",\n          ")}
        };
        const response = await fetch("/hs/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: this.sessionId, actionId, args, signals: signalValues }),
        });
        if (!response.ok) console.error("Action failed:", await response.text());
      },
    };

    function evaluateHsShow() {
      document.querySelectorAll("[hs-show]").forEach((el) => {
        const condition = el.getAttribute("hs-show");
        try { el.style.display = eval(condition) ? "" : "none"; } catch {}
      });
    }

    function evaluateHsText() {
      document.querySelectorAll("[hs-text]").forEach((el) => {
        const expr = el.getAttribute("hs-text");
        try { el.textContent = eval(expr); } catch {}
      });
    }

    const sse = new EventSource("/hs/sse?sessionId=" + Hyperstar.sessionId);
    sse.addEventListener("morph", (e) => {
      const { html, target } = JSON.parse(e.data);
      const targetEl = document.getElementById(target || "app");
      if (targetEl) {
        Idiomorph.morph(targetEl, html, { morphStyle: "innerHTML" });
        evaluateHsShow();
        evaluateHsText();
      }
    });
    sse.addEventListener("signals", (e) => {
      const patches = JSON.parse(e.data);
      for (const [name, value] of Object.entries(patches)) {
        const signalRef = eval("$" + name);
        if (signalRef) signalRef.value = value;
      }
    });
    sse.addEventListener("redirect", (e) => { window.location.href = e.data; });
    sse.addEventListener("title", (e) => { document.title = JSON.parse(e.data).title; });
    sse.addEventListener("favicon", (e) => {
      const { href, type } = JSON.parse(e.data);
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.type = type; link.href = href;
    });

    window.Hyperstar = Hyperstar;

    document.addEventListener("click", (e) => {
      const target = e.target.closest("[hs-on\\\\:click]");
      if (target) { e.preventDefault(); new Function("event", target.getAttribute("hs-on:click"))(e); }
    });
    document.addEventListener("submit", (e) => {
      const target = e.target.closest("[hs-on\\\\:submit]");
      if (target) { e.preventDefault(); new Function("event", target.getAttribute("hs-on:submit"))(e); }
    });
    document.addEventListener("input", (e) => {
      const target = e.target;
      const bind = target.getAttribute("hs-bind");
      if (bind) {
        const signalRef = eval("$" + bind);
        if (signalRef) signalRef.value = target.type === "checkbox" ? target.checked : target.value;
      }
    });

    effect(() => {
      ${Object.keys(signalDefaults).map((name) => `void $${name}.value;`).join("\n      ")}
      evaluateHsShow();
      evaluateHsText();
    });
    evaluateHsShow();
    evaluateHsText();
  </script>
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
          const html = renderFullDocument(session)
          return new Response(html, {
            headers: {
              "Content-Type": "text/html",
              "Set-Cookie": `hs_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
            },
          })
        }

        if (reqPath === "/hs/sse") {
          const finalSessionId = sessionId
          const stream = new ReadableStream({
            start(controller) {
              sseClients.set(finalSessionId, { controller, session })
              config.onConnect?.({ session, store: getStore(), update: updateStore })
              controller.enqueue(new TextEncoder().encode(": connected\n\n"))
            },
            cancel() {
              sseClients.delete(finalSessionId)
              cleanupSession(finalSessionId)
              config.onDisconnect?.({ session, store: getStore(), update: updateStore })
            },
          })
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
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
                action.run(actionCtx as any, args),
                Effect.catchAll((error) => {
                  console.error("Action error:", error)
                  return Effect.succeed(undefined)
                }),
              ),
            )

            for (const [, client] of sseClients) {
              const html = renderView(client.session)
              const event = SSE.morph(html, "app")
              const message = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
              try {
                client.controller.enqueue(new TextEncoder().encode(message))
              } catch {
                // Client disconnected
              }
            }

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

      // Start timers/intervals/crons
      const startScheduledTasks = (forkScoped: <A>(effect: Effect.Effect<A, never, never>) => void) => {
        // Timers
        for (const { id, config: timerConfig } of timerDefs) {
          const frameTimestamps: number[] = []
          let fiber: Fiber.RuntimeFiber<void, never> | null = null
          let pauseRef: Ref.Ref<boolean> | null = null
          let isRunning = false

          const calculateFps = (): number => {
            if (!timerConfig.trackFps) return 0
            const now = Date.now()
            while (frameTimestamps.length > 0 && now - frameTimestamps[0]! > 1000) frameTimestamps.shift()
            return frameTimestamps.length
          }

          const startTimer = () => {
            if (isRunning) return
            console.log(`⏱️  [Timer:${id}] Started (interval: ${timerConfig.interval}ms)`)
            pauseRef = Effect.runSync(Ref.make(false))

            const runOnce = Effect.sync(() => {
              const paused = Effect.runSync(Ref.get(pauseRef!))
              if (paused) return
              if (timerConfig.when && !timerConfig.when(getStore())) return
              if (timerConfig.trackFps) frameTimestamps.push(Date.now())
              timerConfig.handler({ update: updateStore, getStore, fps: calculateFps() })
            })

            fiber = Effect.runFork(
              pipe(runOnce, Effect.repeat(Schedule.spaced(Duration.millis(timerConfig.interval))), Effect.asVoid, Effect.catchAll(() => Effect.void)),
            ) as Fiber.RuntimeFiber<void, never>
            isRunning = true
          }

          const handle: TimerHandle = {
            id,
            get isRunning() { return isRunning },
            start() { startTimer() },
            stop() {
              console.log(`⏱️  [Timer:${id}] Stopped`)
              if (pauseRef) Effect.runSync(Ref.set(pauseRef, true))
              if (fiber) { Effect.runFork(Fiber.interruptFork(fiber)); fiber = null }
              isRunning = false
            },
          }

          startTimer()
          timerHandles.set(id, handle)
        }

        // Intervals
        for (const { id, config: intervalConfig } of intervalDefs) {
          const duration = typeof intervalConfig.every === "number"
            ? Duration.millis(intervalConfig.every)
            : Duration.decode(intervalConfig.every as Duration.DurationInput)
          let fiber: Fiber.RuntimeFiber<void, never> | null = null
          let pauseRef: Ref.Ref<boolean> | null = null
          let isRunning = false

          const startInterval = () => {
            if (isRunning) return
            console.log(`🔄 [Interval:${id}] Started (every: ${Duration.toMillis(duration)}ms)`)
            pauseRef = Effect.runSync(Ref.make(false))

            const runOnce = Effect.sync(() => {
              const paused = Effect.runSync(Ref.get(pauseRef!))
              if (paused) return
              intervalConfig.handler({ update: updateStore, getStore })
            })

            fiber = Effect.runFork(
              pipe(runOnce, Effect.repeat(Schedule.spaced(duration)), Effect.asVoid, Effect.catchAll(() => Effect.void)),
            ) as Fiber.RuntimeFiber<void, never>
            isRunning = true
          }

          const handle: IntervalHandle = {
            id,
            get isRunning() { return isRunning },
            start() { startInterval() },
            stop() {
              console.log(`🔄 [Interval:${id}] Stopped`)
              if (pauseRef) Effect.runSync(Ref.set(pauseRef, true))
              if (fiber) { Effect.runFork(Fiber.interruptFork(fiber)); fiber = null }
              isRunning = false
            },
          }

          startInterval()
          intervalHandles.set(id, handle)
        }

        // Crons
        for (const { id, config: cronConfig } of cronDefs) {
          const effectSchedule = parseScheduleString(cronConfig.schedule)
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

          console.log(`📅 [Cron:${id}] Started (schedule: ${cronConfig.schedule})`)
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
              Stream.tap(() =>
                Effect.sync(() => {
                  for (const [, client] of sseClients) {
                    const html = renderView(client.session)
                    const event = SSE.morph(html, "app")
                    const message = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
                    try {
                      client.controller.enqueue(new TextEncoder().encode(message))
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

          const server = Bun.serve({ port, hostname, fetch: handleRequest })
          const actualPort = server.port ?? port
          console.log(`🌟 Hyperstar v3 running at http://localhost:${actualPort}`)

          // Handle graceful shutdown signals (for Sprites hibernation, Ctrl+C, etc.)
          const app = {
            port: actualPort,
            stop: async () => {
              // Stop timers and intervals (these use their own fibers with pauseRef)
              for (const timer of timerHandles.values()) timer.stop()
              timerHandles.clear()
              for (const interval of intervalHandles.values()) interval.stop()
              intervalHandles.clear()
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
