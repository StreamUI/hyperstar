/**
 * Hyperstar v3 - Schedule Service
 *
 * Periodic job scheduling using Effect.Service pattern.
 * Combines tag definition and implementation in a single class.
 */
import {
  Effect,
  Fiber,
  Ref,
  HashMap,
  PubSub,
  Stream,
  Schedule,
  pipe,
} from "effect"
import { ScheduleError, Recovery } from "../core/errors"

// ============================================================================
// Job Configuration
// ============================================================================

export type OnErrorPolicy = "continue" | "stop" | "pause"

export interface JobDef<A = unknown, E = unknown> {
  /** Unique job identifier */
  readonly id: string
  /** Human-readable job name */
  readonly name: string
  /** The effect to execute on each trigger */
  readonly effect: Effect.Effect<A, E>
  /** Schedule definition (use Cron helpers) */
  readonly schedule: Schedule.Schedule<unknown, unknown>
  /** What to do when the job fails */
  readonly onError?: OnErrorPolicy
  /** Number of retries per execution */
  readonly retries?: number
  /** Optional metadata */
  readonly metadata?: Record<string, unknown>
}

// ============================================================================
// Job Handle & Info
// ============================================================================

export interface JobHandle {
  /** Job ID */
  readonly id: string
  /** Job name */
  readonly name: string
  /** Pause the job */
  readonly pause: Effect.Effect<void>
  /** Resume the job */
  readonly resume: Effect.Effect<void>
  /** Trigger the job manually */
  readonly trigger: Effect.Effect<void>
  /** Check if job is paused */
  readonly isPaused: Effect.Effect<boolean>
}

export type JobStatus = "running" | "paused" | "stopped" | "error"

export interface JobInfo {
  /** Job ID */
  readonly id: string
  /** Job name */
  readonly name: string
  /** Current status */
  readonly status: JobStatus
  /** Number of times executed */
  readonly executionCount: number
  /** Last execution time */
  readonly lastExecutedAt?: Date
  /** Next scheduled execution time (approximate) */
  readonly nextExecutionAt?: Date
  /** Last error if any */
  readonly lastError?: string
  /** When the job was registered */
  readonly registeredAt: Date
  /** Optional metadata */
  readonly metadata?: Record<string, unknown>
}

export type JobEvent =
  | { readonly type: "registered"; readonly job: JobInfo }
  | { readonly type: "started"; readonly jobId: string }
  | { readonly type: "completed"; readonly jobId: string; readonly result: unknown }
  | { readonly type: "failed"; readonly jobId: string; readonly error: string }
  | { readonly type: "paused"; readonly jobId: string }
  | { readonly type: "resumed"; readonly jobId: string }
  | { readonly type: "unregistered"; readonly jobId: string }

// ============================================================================
// Internal State
// ============================================================================

interface InternalJob {
  readonly info: JobInfo
  readonly fiber: Fiber.RuntimeFiber<void, never>
  readonly pauseRef: Ref.Ref<boolean>
  readonly def: JobDef<unknown, unknown>
}

// ============================================================================
// Schedule Service - Effect.Service Pattern
// ============================================================================

export class ScheduleService extends Effect.Service<ScheduleService>()("hyperstar/ScheduleService", {
  effect: Effect.gen(function* () {
    // Job storage
    const jobs = yield* Ref.make(HashMap.empty<string, InternalJob>())

    // Event pubsub
    const eventPubSub = yield* PubSub.unbounded<JobEvent>()

    // Update job info helper
    const updateJobInfo = (id: string, updates: Partial<JobInfo>) =>
      Ref.update(jobs, (map) => {
        const existing = HashMap.get(map, id)
        if (existing._tag === "None") return map
        return HashMap.set(map, id, {
          ...existing.value,
          info: { ...existing.value.info, ...updates },
        })
      })

    // Create job runner fiber
    const createJobFiber = (
      def: JobDef<unknown, unknown>,
      pauseRef: Ref.Ref<boolean>,
    ): Effect.Effect<Fiber.RuntimeFiber<void, never>> => {
      const runOnce = Effect.gen(function* () {
        const isPaused = yield* Ref.get(pauseRef)
        if (isPaused) return

        yield* PubSub.publish(eventPubSub, { type: "started", jobId: def.id })

        yield* pipe(
          def.effect,
          def.retries
            ? Effect.retry(
                pipe(
                  Schedule.exponential("100 millis"),
                  Schedule.jittered,
                  Schedule.intersect(Schedule.recurs(def.retries)),
                ),
              )
            : (e) => e,
          Effect.matchEffect({
            onSuccess: (_result) =>
              Effect.gen(function* () {
                yield* updateJobInfo(def.id, {
                  lastExecutedAt: new Date(),
                  status: "running" as JobStatus,
                })
                yield* Ref.update(jobs, (map) => {
                  const existing = HashMap.get(map, def.id)
                  if (existing._tag === "None") return map
                  return HashMap.set(map, def.id, {
                    ...existing.value,
                    info: {
                      ...existing.value.info,
                      executionCount: existing.value.info.executionCount + 1,
                    },
                  })
                })
                yield* PubSub.publish(eventPubSub, {
                  type: "completed",
                  jobId: def.id,
                  result: _result,
                })
              }),
            onFailure: (error) =>
              Effect.gen(function* () {
                const errorStr = String(error)
                const onError = def.onError ?? "continue"

                yield* updateJobInfo(def.id, {
                  lastExecutedAt: new Date(),
                  lastError: errorStr,
                  status: onError === "stop" ? "stopped" as JobStatus : onError === "pause" ? "paused" as JobStatus : "running" as JobStatus,
                })

                if (onError === "pause") {
                  yield* Ref.set(pauseRef, true)
                }

                yield* PubSub.publish(eventPubSub, {
                  type: "failed",
                  jobId: def.id,
                  error: errorStr,
                })
              }),
          }),
        )
      })

      // Create scheduled effect
      const scheduled = pipe(
        runOnce,
        Effect.repeat(def.schedule),
        Effect.catchAll(() => Effect.void),
      )

      return Effect.fork(scheduled) as Effect.Effect<Fiber.RuntimeFiber<void, never>>
    }

    // Helper to create JobHandle
    const createHandle = (
      id: string,
      name: string,
      pauseRef: Ref.Ref<boolean>,
    ): JobHandle => ({
      id,
      name,
      pause: Effect.gen(function* () {
        yield* Ref.set(pauseRef, true)
        yield* updateJobInfo(id, { status: "paused" as JobStatus })
        yield* PubSub.publish(eventPubSub, { type: "paused", jobId: id })
      }),
      resume: Effect.gen(function* () {
        yield* Ref.set(pauseRef, false)
        yield* updateJobInfo(id, { status: "running" as JobStatus })
        yield* PubSub.publish(eventPubSub, { type: "resumed", jobId: id })
      }),
      trigger: Effect.gen(function* () {
        const allJobs = yield* Ref.get(jobs)
        const job = HashMap.get(allJobs, id)
        if (job._tag === "None") return

        yield* PubSub.publish(eventPubSub, { type: "started", jobId: id })
        yield* pipe(
          job.value.def.effect,
          Effect.matchEffect({
            onSuccess: (result) =>
              Effect.gen(function* () {
                yield* updateJobInfo(id, { lastExecutedAt: new Date() })
                yield* Ref.update(jobs, (map) => {
                  const existing = HashMap.get(map, id)
                  if (existing._tag === "None") return map
                  return HashMap.set(map, id, {
                    ...existing.value,
                    info: {
                      ...existing.value.info,
                      executionCount: existing.value.info.executionCount + 1,
                    },
                  })
                })
                yield* PubSub.publish(eventPubSub, { type: "completed", jobId: id, result })
              }),
            onFailure: (error) =>
              Effect.gen(function* () {
                yield* updateJobInfo(id, { lastError: String(error), lastExecutedAt: new Date() })
                yield* PubSub.publish(eventPubSub, { type: "failed", jobId: id, error: String(error) })
              }),
          }),
        )
      }),
      isPaused: Ref.get(pauseRef),
    })

    // Return the service API
    return {
      register: <A, E>(def: JobDef<A, E>) =>
        Effect.gen(function* () {
          // Check if already exists
          const allJobs = yield* Ref.get(jobs)
          if (HashMap.has(allJobs, def.id)) {
            return yield* Effect.fail(
              new ScheduleError({
                jobId: def.id,
                type: "already_running",
                recovery: Recovery.escalate("Job already registered", "JOB_EXISTS"),
              }),
            )
          }

          const registeredAt = new Date()
          const pauseRef = yield* Ref.make(false)

          const info: JobInfo = {
            id: def.id,
            name: def.name,
            status: "running",
            executionCount: 0,
            registeredAt,
            ...(def.metadata ? { metadata: def.metadata } : {}),
          }

          // Create and start the job fiber
          const fiber = yield* createJobFiber(def as JobDef<unknown, unknown>, pauseRef)

          const internalJob: InternalJob = {
            info,
            fiber,
            pauseRef,
            def: def as JobDef<unknown, unknown>,
          }

          yield* Ref.update(jobs, HashMap.set(def.id, internalJob))
          yield* PubSub.publish(eventPubSub, { type: "registered", job: info })

          return createHandle(def.id, def.name, pauseRef)
        }),

      unregister: (id: string) =>
        Effect.gen(function* () {
          const allJobs = yield* Ref.get(jobs)
          const job = HashMap.get(allJobs, id)

          if (job._tag === "None") {
            return yield* Effect.fail(
              new ScheduleError({
                jobId: id,
                type: "not_found",
                recovery: Recovery.ignore(),
              }),
            )
          }

          // Stop the fiber
          yield* Fiber.interrupt(job.value.fiber)

          // Remove from jobs
          yield* Ref.update(jobs, HashMap.remove(id))
          yield* PubSub.publish(eventPubSub, { type: "unregistered", jobId: id })

          return true
        }),

      pause: (id: string) =>
        Effect.gen(function* () {
          const allJobs = yield* Ref.get(jobs)
          const job = HashMap.get(allJobs, id)

          if (job._tag === "None") {
            return yield* Effect.fail(
              new ScheduleError({
                jobId: id,
                type: "not_found",
                recovery: Recovery.ignore(),
              }),
            )
          }

          yield* Ref.set(job.value.pauseRef, true)
          yield* updateJobInfo(id, { status: "paused" as JobStatus })
          yield* PubSub.publish(eventPubSub, { type: "paused", jobId: id })
        }),

      resume: (id: string) =>
        Effect.gen(function* () {
          const allJobs = yield* Ref.get(jobs)
          const job = HashMap.get(allJobs, id)

          if (job._tag === "None") {
            return yield* Effect.fail(
              new ScheduleError({
                jobId: id,
                type: "not_found",
                recovery: Recovery.ignore(),
              }),
            )
          }

          yield* Ref.set(job.value.pauseRef, false)
          yield* updateJobInfo(id, { status: "running" as JobStatus })
          yield* PubSub.publish(eventPubSub, { type: "resumed", jobId: id })
        }),

      trigger: (id: string) =>
        Effect.gen(function* () {
          const allJobs = yield* Ref.get(jobs)
          const job = HashMap.get(allJobs, id)

          if (job._tag === "None") {
            return yield* Effect.fail(
              new ScheduleError({
                jobId: id,
                type: "not_found",
                recovery: Recovery.ignore(),
              }),
            )
          }

          yield* PubSub.publish(eventPubSub, { type: "started", jobId: id })

          yield* pipe(
            job.value.def.effect,
            Effect.matchEffect({
              onSuccess: (result) =>
                Effect.gen(function* () {
                  yield* updateJobInfo(id, { lastExecutedAt: new Date() })
                  yield* Ref.update(jobs, (map) => {
                    const existing = HashMap.get(map, id)
                    if (existing._tag === "None") return map
                    return HashMap.set(map, id, {
                      ...existing.value,
                      info: {
                        ...existing.value.info,
                        executionCount: existing.value.info.executionCount + 1,
                      },
                    })
                  })
                  yield* PubSub.publish(eventPubSub, { type: "completed", jobId: id, result })
                }),
              onFailure: (error) =>
                Effect.gen(function* () {
                  yield* updateJobInfo(id, { lastError: String(error), lastExecutedAt: new Date() })
                  yield* PubSub.publish(eventPubSub, { type: "failed", jobId: id, error: String(error) })
                }),
            }),
          )
        }),

      get: (id: string) =>
        Effect.gen(function* () {
          const allJobs = yield* Ref.get(jobs)
          const job = HashMap.get(allJobs, id)
          return job._tag === "Some" ? job.value.info : null
        }),

      list: Effect.map(Ref.get(jobs), (map) =>
        Array.from(HashMap.values(map)).map((j) => j.info),
      ),

      events: pipe(
        Stream.fromPubSub(eventPubSub),
        Stream.mapError(
          (cause) =>
            new ScheduleError({
              jobId: "events",
              type: "execution",
              cause,
              recovery: Recovery.retry(),
            }),
        ),
      ),
    }
  }),
}) {}

// ============================================================================
// Type exports for API
// ============================================================================

export type ScheduleServiceApi = Effect.Effect.Success<typeof ScheduleService>
