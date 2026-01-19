/**
 * Hyperstar v3 - Simplified Action Schema
 *
 * Minimal API: just app.action() with two overloads.
 * All action validation flows through Effect Schema.
 */
import { Effect, Schema, pipe } from "effect"
import { ActionError, ValidationError, Recovery } from "../core/errors"
import {
  type StoreServiceApi,
  type UserStoreServiceApi,
  type SSEServiceApi,
  type SignalServiceApi,
  type Session,
} from "../core/services"

// ============================================================================
// Action Context Types
// ============================================================================

/**
 * Head service for updating document title and favicon.
 */
export interface HeadServiceApi {
  /** Update the document title for all connected clients */
  readonly setTitle: (title: string) => Effect.Effect<void>
  /** Update the favicon for all connected clients */
  readonly setFavicon: (href: string, type?: string) => Effect.Effect<void>
}

/**
 * Full action context with Effect services (internal use).
 */
export interface ActionContext<S, U> {
  /** Current session */
  readonly session: Session
  /** Store service for global state */
  readonly store: StoreServiceApi<S>
  /** User store service for per-user state */
  readonly userStore: UserStoreServiceApi<U>
  /** SSE service for broadcasting */
  readonly sse: SSEServiceApi
  /** Signal service for client state */
  readonly signals: SignalServiceApi
  /** Head service for document title/favicon updates */
  readonly head: HeadServiceApi
}

// ============================================================================
// Simplified Context (what users see)
// ============================================================================

/**
 * Simplified head service for updating document title and favicon.
 */
export interface SimplifiedHeadService {
  /** Update the document title for all connected clients */
  setTitle: (title: string) => void
  /** Update the favicon for all connected clients */
  setFavicon: (href: string, type?: string) => void
}

/**
 * Simplified context for action handlers.
 * Provides a clean API without Effect wrappers.
 *
 * @template S - Store type
 * @template U - User store type
 * @template Signals - Signal schema type (for type-safe patchSignals)
 */
export interface SimplifiedActionContext<
  S,
  U,
  Signals extends object = Record<string, unknown>,
> {
  /** Current session (includes sessionId, userId, etc.) */
  readonly session: Session
  /** Update the store with a function */
  readonly update: (fn: (s: S) => S) => void
  /** Get the current store value */
  readonly getStore: () => S
  /** Update the user store with a function */
  readonly updateUserStore: (fn: (u: U) => U) => void
  /** Get the current user store value */
  readonly getUserStore: () => U
  /** Shortcut: current session ID */
  readonly sessionId: string
  /** Head service for updating document title/favicon */
  readonly head: SimplifiedHeadService
  /**
   * Patch client-side signals (broadcast to all clients).
   * When using signals schema in createHyperstar, this is fully typed.
   */
  readonly patchSignals: (patches: Partial<Signals>) => void
}

/**
 * Internal helper to create simplified context from action context.
 */
export const createSimplifiedContext = <S, U>(
  ctx: ActionContext<S, U>,
): SimplifiedActionContext<S, U> => ({
  session: ctx.session,
  sessionId: ctx.session.id,
  update: (fn) => Effect.runSync(ctx.store.update(fn)),
  getStore: () => Effect.runSync(ctx.store.get),
  updateUserStore: (fn) => Effect.runSync(ctx.userStore.update(fn)),
  getUserStore: () => Effect.runSync(ctx.userStore.get),
  head: {
    setTitle: (title) => Effect.runSync(ctx.head.setTitle(title)),
    setFavicon: (href, type) => Effect.runSync(ctx.head.setFavicon(href, type)),
  },
  patchSignals: (patches) => Effect.runSync(ctx.signals.patch(patches)),
})

// ============================================================================
// Action Descriptor
// ============================================================================

/**
 * A registered action descriptor.
 * Created by app.action() and can be passed to on.action().
 */
export interface ActionDescriptor<
  I = unknown,
  O = unknown,
  S = unknown,
  U = unknown,
> {
  readonly _tag: "ActionDescriptor"
  readonly id: string
  readonly name: string
  readonly inputSchema: Schema.Schema<I>
  readonly outputSchema: Schema.Schema<O> | null
  readonly run: (
    ctx: ActionContext<S, U>,
    rawInput: unknown,
  ) => Effect.Effect<O, ActionError | ValidationError>
}

// ============================================================================
// Internal: Create Action Descriptor
// ============================================================================

let actionCounter = 0

/**
 * Internal function to create an action descriptor.
 * Used by app.action() overloads.
 */
export const createActionDescriptor = <I, S, U>(config: {
  id: string
  inputSchema: Schema.Schema<I>
  handler: (ctx: SimplifiedActionContext<S, U>, input: I) => void | Promise<void>
}): ActionDescriptor<I, void, S, U> => {
  const id = config.id ?? `action_${++actionCounter}`
  const decodeInput = Schema.decodeUnknown(config.inputSchema)

  // Detect if handler is async
  const isAsync =
    config.handler.constructor.name === "AsyncFunction" ||
    config.handler.toString().includes("__async")

  const run = (
    ctx: ActionContext<S, U>,
    rawInput: unknown,
  ): Effect.Effect<void, ActionError | ValidationError> =>
    Effect.gen(function* () {
      // 1. Validate input
      const input = yield* pipe(
        decodeInput(rawInput),
        Effect.mapError((error) => {
          const issues = error.message
          return new ValidationError({
            field: "input",
            message: issues,
            value: rawInput,
            recovery: Recovery.escalate(
              `Invalid input for action ${id}: ${issues}`,
              "VALIDATION_ERROR",
            ),
          })
        }),
      )

      // 2. Execute handler
      const simplified = createSimplifiedContext(ctx)

      if (isAsync) {
        yield* pipe(
          Effect.promise(async () => {
            await config.handler(simplified, input)
          }),
          Effect.mapError((error): ActionError =>
            new ActionError({
              actionId: id,
              phase: "execution",
              cause: error,
              recovery: Recovery.retry(),
            }),
          ),
        )
      } else {
        yield* pipe(
          Effect.sync(() => {
            config.handler(simplified, input)
          }),
          Effect.mapError((error): ActionError =>
            new ActionError({
              actionId: id,
              phase: "execution",
              cause: error,
              recovery: Recovery.retry(),
            }),
          ),
        )
      }
    })

  return {
    _tag: "ActionDescriptor",
    id,
    name: id,
    inputSchema: config.inputSchema,
    outputSchema: null,
    run,
  }
}

/**
 * Create an action with no arguments.
 */
export const createNoArgsAction = <S, U>(
  id: string,
  handler: (ctx: SimplifiedActionContext<S, U>) => void | Promise<void>,
): ActionDescriptor<void, void, S, U> =>
  createActionDescriptor({
    id,
    inputSchema: Schema.Void,
    handler: (ctx, _input) => handler(ctx),
  })

/**
 * Create an action with schema-validated arguments.
 */
export const createWithArgsAction = <
  Args extends Record<string, Schema.Schema.Any>,
  S,
  U,
>(
  id: string,
  args: Args,
  handler: (
    ctx: SimplifiedActionContext<S, U>,
    args: { [K in keyof Args]: Schema.Schema.Type<Args[K]> },
  ) => void | Promise<void>,
): ActionDescriptor<{ [K in keyof Args]: Schema.Schema.Type<Args[K]> }, void, S, U> => {
  type ArgsType = { [K in keyof Args]: Schema.Schema.Type<Args[K]> }
  const inputSchema = Schema.Struct(args) as unknown as Schema.Schema<ArgsType>

  return createActionDescriptor({
    id,
    inputSchema,
    handler,
  })
}
