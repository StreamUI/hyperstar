/**
 * Hyperstar v3 - Layer Implementations
 *
 * Provides live implementations of all Effect Services.
 * Composition at the edge - swap implementations for testing.
 */
import {
  Layer,
  Effect,
  SubscriptionRef,
  Stream,
  Ref,
  HashMap,
  PubSub,
  pipe,
} from "effect"
import {
  StoreService,
  UserStoreService,
  SSEService,
  SignalService,
  ActionRegistry,
  type SSEClient,
  type SSEEventTyped,
  type ActionMeta,
  type StoreServiceApi,
  type UserStoreServiceApi,
} from "./services"
import { StoreError, SSEError, SignalError, ActionError, Recovery } from "./errors"

// ============================================================================
// Store Layer - Reactive state with SubscriptionRef
// ============================================================================

export const makeStoreLayer = <S>(initial: S) =>
  Layer.effect(
    StoreService,
    Effect.gen(function* () {
      const ref = yield* SubscriptionRef.make(initial)

      const update = (fn: (s: S) => S) =>
        Effect.catchAll(SubscriptionRef.update(ref, fn), (cause) =>
          Effect.fail(
            new StoreError({
              operation: "write",
              cause,
              recovery: Recovery.retry(),
            }),
          ),
        )

      const api: StoreServiceApi<S> = {
        ref,
        get: Effect.catchAll(SubscriptionRef.get(ref), (cause) =>
          Effect.fail(
            new StoreError({
              operation: "read",
              cause,
              recovery: Recovery.retry(),
            }),
          ),
        ),
        update,
        set: (s: S) =>
          Effect.catchAll(SubscriptionRef.set(ref, s), (cause) =>
            Effect.fail(
              new StoreError({
                operation: "write",
                cause,
                recovery: Recovery.retry(),
              }),
            ),
          ),
        changes: pipe(
          ref.changes,
          Stream.mapError(
            (cause) =>
              new StoreError({
                operation: "subscribe",
                cause,
                recovery: Recovery.retry(),
              }),
          ),
        ),

        // Convenience helpers
        setKey: (key, value) =>
          update((s) => ({ ...s, [key]: value })),

        append: (key, item) =>
          update((s) => ({
            ...s,
            [key]: [...(s[key] as unknown[]), item],
          })),

        filter: (key, predicate) =>
          update((s) => ({
            ...s,
            [key]: (s[key] as unknown[]).filter(predicate as (item: unknown) => boolean),
          })),

        map: (key, fn) =>
          update((s) => ({
            ...s,
            [key]: (s[key] as unknown[]).map(fn as (item: unknown) => unknown),
          })),
      }

      return api as StoreServiceApi<unknown>
    }),
  )

// ============================================================================
// User Store Layer - Per-user state management
// ============================================================================

export const makeUserStoreLayer = <U>(defaultUser: U, currentUserId: string | null) =>
  Layer.effect(
    UserStoreService,
    Effect.gen(function* () {
      const userStores = yield* Ref.make(HashMap.empty<string, U>())

      const getOrCreate = (userId: string) =>
        Effect.gen(function* () {
          const stores = yield* Ref.get(userStores)
          const existing = HashMap.get(stores, userId)
          if (existing._tag === "Some") {
            return existing.value
          }
          yield* Ref.update(userStores, HashMap.set(userId, defaultUser))
          return defaultUser
        })

      const api: UserStoreServiceApi<U> = {
        get: currentUserId
          ? getOrCreate(currentUserId).pipe(
              Effect.mapError(
                (cause) =>
                  new StoreError({
                    operation: "read",
                    cause,
                    recovery: Recovery.fallback(defaultUser),
                  }),
              ),
            )
          : Effect.succeed(defaultUser),

        update: (fn: (u: U) => U) =>
          currentUserId
            ? Effect.gen(function* () {
                const current = yield* getOrCreate(currentUserId)
                yield* Ref.update(userStores, HashMap.set(currentUserId, fn(current)))
              }).pipe(
                Effect.mapError(
                  (cause) =>
                    new StoreError({
                      operation: "write",
                      cause,
                      recovery: Recovery.retry(),
                    }),
                ),
              )
            : Effect.void,

        getForUser: (userId: string) =>
          getOrCreate(userId).pipe(
            Effect.mapError(
              (cause) =>
                new StoreError({
                  operation: "read",
                  cause,
                  recovery: Recovery.fallback(defaultUser),
                }),
            ),
          ),

        updateForUser: (userId: string, fn: (u: U) => U) =>
          Effect.gen(function* () {
            const current = yield* getOrCreate(userId)
            yield* Ref.update(userStores, HashMap.set(userId, fn(current)))
          }).pipe(
            Effect.mapError(
              (cause) =>
                new StoreError({
                  operation: "write",
                  cause,
                  recovery: Recovery.retry(),
                }),
            ),
          ),
      }

      return api as UserStoreServiceApi<unknown>
    }),
  )

// ============================================================================
// SSE Layer - Server-Sent Events broadcasting
// ============================================================================

export const SSELayer = Layer.effect(
  SSEService,
  Effect.gen(function* () {
    const clients = yield* Ref.make(HashMap.empty<string, SSEClient>())
    const connectionPubSub = yield* PubSub.unbounded<{
      type: "connect" | "disconnect"
      client: SSEClient
    }>()

    return {
      broadcast: (event: SSEEventTyped) =>
        Effect.gen(function* () {
          const allClients = yield* Ref.get(clients)
          yield* Effect.forEach(
            HashMap.values(allClients),
            (client) => client.send(event),
            { concurrency: "unbounded", discard: true },
          )
        }).pipe(
          Effect.mapError(
            (cause) =>
              new SSEError({
                type: "broadcast",
                cause,
                recovery: Recovery.retry(),
              }),
          ),
        ),

      sendTo: (sessionId: string, event: SSEEventTyped) =>
        Effect.gen(function* () {
          const allClients = yield* Ref.get(clients)
          const client = HashMap.get(allClients, sessionId)
          if (client._tag === "Some") {
            yield* client.value.send(event)
          }
        }).pipe(
          Effect.mapError(
            (cause) =>
              new SSEError({
                type: "broadcast",
                cause,
                recovery: Recovery.ignore(),
              }),
          ),
        ),

      sendToUser: (userId: string, event: SSEEventTyped) =>
        Effect.gen(function* () {
          const allClients = yield* Ref.get(clients)
          const userClients = pipe(
            HashMap.values(allClients),
            (iter) => Array.from(iter).filter((c) => c.userId === userId),
          )
          yield* Effect.forEach(userClients, (client) => client.send(event), {
            concurrency: "unbounded",
            discard: true,
          })
        }).pipe(
          Effect.mapError(
            (cause) =>
              new SSEError({
                type: "broadcast",
                cause,
                recovery: Recovery.ignore(),
              }),
          ),
        ),

      connectionCount: Effect.map(Ref.get(clients), HashMap.size),

      register: (client: SSEClient) =>
        Effect.gen(function* () {
          yield* Ref.update(clients, HashMap.set(client.sessionId, client))
          yield* PubSub.publish(connectionPubSub, { type: "connect" as const, client })
        }),

      unregister: (sessionId: string) =>
        Effect.gen(function* () {
          const allClients = yield* Ref.get(clients)
          const client = HashMap.get(allClients, sessionId)
          if (client._tag === "Some") {
            yield* Ref.update(clients, HashMap.remove(sessionId))
            yield* PubSub.publish(connectionPubSub, {
              type: "disconnect" as const,
              client: client.value,
            })
          }
        }),

      connections: pipe(
        Stream.fromPubSub(connectionPubSub),
        Stream.mapError(
          (cause) =>
            new SSEError({
              type: "connection",
              cause,
              recovery: Recovery.retry(),
            }),
        ),
      ),
    }
  }),
)

// ============================================================================
// Signal Layer - Client signal management
// ============================================================================

export const makeSignalLayer = (currentSessionId: string) =>
  Layer.effect(
    SignalService,
    Effect.gen(function* () {
      const signals = yield* Ref.make(
        HashMap.empty<string, Record<string, unknown>>(),
      )

      return {
        patch: (patches: Record<string, unknown>) =>
          Ref.update(signals, (s) => {
            const current = HashMap.get(s, currentSessionId)
            const updated =
              current._tag === "Some"
                ? { ...current.value, ...patches }
                : patches
            return HashMap.set(s, currentSessionId, updated)
          }).pipe(
            Effect.mapError(
              (cause) =>
                new SignalError({
                  signalName: Object.keys(patches).join(", "),
                  operation: "set",
                  cause,
                  recovery: Recovery.retry(),
                }),
            ),
          ),

        patchFor: (sessionId: string, patches: Record<string, unknown>) =>
          Ref.update(signals, (s) => {
            const current = HashMap.get(s, sessionId)
            const updated =
              current._tag === "Some"
                ? { ...current.value, ...patches }
                : patches
            return HashMap.set(s, sessionId, updated)
          }).pipe(
            Effect.mapError(
              (cause) =>
                new SignalError({
                  signalName: Object.keys(patches).join(", "),
                  operation: "set",
                  cause,
                  recovery: Recovery.retry(),
                }),
            ),
          ),

        get: (sessionId: string, name: string) =>
          Effect.gen(function* () {
            const allSignals = yield* Ref.get(signals)
            const sessionSignals = HashMap.get(allSignals, sessionId)
            if (sessionSignals._tag === "Some") {
              return sessionSignals.value[name]
            }
            return undefined
          }).pipe(
            Effect.mapError(
              (cause) =>
                new SignalError({
                  signalName: name,
                  operation: "get",
                  cause,
                  recovery: Recovery.fallback(undefined),
                }),
            ),
          ),
      }
    }),
  )

// ============================================================================
// Action Registry Layer
// ============================================================================

export const ActionRegistryLayer = Layer.effect(
  ActionRegistry,
  Effect.gen(function* () {
    const actions = yield* Ref.make(
      HashMap.empty<string, { meta: ActionMeta; handler: unknown }>(),
    )

    return {
      register: (meta: ActionMeta, handler: unknown) =>
        Ref.update(actions, HashMap.set(meta.id, { meta, handler })),

      get: (id: string) =>
        Effect.map(Ref.get(actions), (a) => {
          const entry = HashMap.get(a, id)
          return entry._tag === "Some" ? entry.value.meta : null
        }),

      list: Effect.map(Ref.get(actions), (a) =>
        Array.from(HashMap.values(a)).map((e) => e.meta),
      ),

      execute: (id: string, _args: unknown) =>
        Effect.gen(function* () {
          const allActions = yield* Ref.get(actions)
          const action = HashMap.get(allActions, id)
          if (action._tag === "None") {
            return yield* Effect.fail(
              new ActionError({
                actionId: id,
                phase: "execution",
                cause: `Action not found: ${id}`,
                recovery: Recovery.escalate(
                  `Action "${id}" not found`,
                  "ACTION_NOT_FOUND",
                ),
              }),
            )
          }
          // Handler execution would go here
          // This is a placeholder - actual execution happens in the server
        }),
    }
  }),
)

// ============================================================================
// Compose All Layers
// ============================================================================

export const makeAppLayers = <S, U>(config: {
  store: S
  userStore: U
  sessionId: string
  userId: string | null
}) =>
  Layer.mergeAll(
    makeStoreLayer(config.store),
    makeUserStoreLayer(config.userStore, config.userId),
    SSELayer,
    makeSignalLayer(config.sessionId),
    ActionRegistryLayer,
  )
