/**
 * Hyperstar v3 - Task Service
 *
 * Background task execution with priority queuing and progress tracking.
 * Uses Effect.Service pattern for simplified service definition.
 */
import {
  Effect,
  Queue,
  Fiber,
  Ref,
  HashMap,
  PubSub,
  Stream,
  Duration,
  Schedule,
  Deferred,
  pipe,
} from "effect"
import { TaskError, Recovery } from "../core/errors"
import { SSEService, SSE } from "../core/services"

// ============================================================================
// Task Configuration
// ============================================================================

export type TaskPriority = "low" | "normal" | "high" | "critical"

export interface TaskDef<A = unknown, E = unknown> {
  /** Unique task identifier */
  readonly id: string
  /** Human-readable task name */
  readonly name: string
  /** The effect to execute */
  readonly effect: Effect.Effect<A, E>
  /** Task priority (default: normal) */
  readonly priority?: TaskPriority
  /** Timeout duration */
  readonly timeout?: Duration.DurationInput
  /** Number of retries on failure */
  readonly retries?: number
  /** Custom retry schedule */
  readonly retrySchedule?: Schedule.Schedule<unknown, E>
  /** Optional metadata */
  readonly metadata?: Record<string, unknown>
}

// ============================================================================
// Task Handle & Info
// ============================================================================

export interface TaskHandle<A = unknown> {
  /** Task ID */
  readonly id: string
  /** Task name */
  readonly name: string
  /** Wait for task completion */
  readonly await: Effect.Effect<A, TaskError>
  /** Cancel the task */
  readonly cancel: Effect.Effect<boolean, TaskError>
  /** Check if task is still running */
  readonly isRunning: Effect.Effect<boolean>
}

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface TaskInfo {
  /** Task ID */
  readonly id: string
  /** Task name */
  readonly name: string
  /** Current status */
  readonly status: TaskStatus
  /** Progress percentage (0-100) */
  readonly progress: number
  /** Progress message */
  readonly message?: string
  /** Current stage/phase */
  readonly stage?: string
  /** When the task was submitted */
  readonly submittedAt: Date
  /** When the task started running */
  readonly startedAt?: Date
  /** When the task completed */
  readonly completedAt?: Date
  /** Result if completed successfully */
  readonly result?: unknown
  /** Error if failed */
  readonly error?: string
  /** Task priority */
  readonly priority: TaskPriority
  /** Optional metadata */
  readonly metadata?: Record<string, unknown>
}

// ============================================================================
// Progress Context
// ============================================================================

export interface TaskProgressContext {
  /** Report progress (0-100) */
  readonly progress: (percent: number, message?: string, stage?: string) => Effect.Effect<void>
  /** Get current task ID */
  readonly taskId: string
}

export type TaskEvent =
  | { readonly type: "submitted"; readonly task: TaskInfo }
  | { readonly type: "started"; readonly taskId: string }
  | { readonly type: "progress"; readonly taskId: string; readonly progress: number; readonly message?: string; readonly stage?: string }
  | { readonly type: "completed"; readonly taskId: string; readonly result: unknown }
  | { readonly type: "failed"; readonly taskId: string; readonly error: string }
  | { readonly type: "cancelled"; readonly taskId: string }

// ============================================================================
// Internal State
// ============================================================================

interface QueuedTask {
  readonly def: TaskDef<unknown, unknown>
  readonly deferred: Deferred.Deferred<unknown, TaskError>
  readonly submittedAt: Date
}

interface InternalTask {
  readonly info: TaskInfo
  readonly fiber?: Fiber.RuntimeFiber<unknown, TaskError>
  readonly deferred: Deferred.Deferred<unknown, TaskError>
}

// ============================================================================
// Task Service - Effect.Service Pattern
// ============================================================================

export class TaskService extends Effect.Service<TaskService>()("hyperstar/TaskService", {
  effect: Effect.gen(function* () {
    const sse = yield* SSEService

    // Task storage
    const tasks = yield* Ref.make(HashMap.empty<string, InternalTask>())

    // Event pubsub
    const eventPubSub = yield* PubSub.unbounded<TaskEvent>()

    // Priority queue for pending tasks
    const taskQueue = yield* Queue.unbounded<QueuedTask>()

    // Worker count
    const maxWorkers = 4
    const activeWorkers = yield* Ref.make(0)

    // Broadcast SSE for task events
    const broadcastTaskEvent = (event: ReturnType<typeof SSE.taskProgress | typeof SSE.taskComplete>) =>
      sse.broadcast(event)

    // Update task info
    const updateTaskInfo = (id: string, updates: Partial<TaskInfo>) =>
      Ref.update(tasks, (map) => {
        const existing = HashMap.get(map, id)
        if (existing._tag === "None") return map
        return HashMap.set(map, id, {
          ...existing.value,
          info: { ...existing.value.info, ...updates },
        })
      })

    // Process a single task
    const processTask = (task: QueuedTask): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const { def, deferred } = task
        const startedAt = new Date()

        // Mark as running
        yield* updateTaskInfo(def.id, { status: "running" as TaskStatus, startedAt })
        yield* PubSub.publish(eventPubSub, { type: "started", taskId: def.id })
        yield* pipe(
          broadcastTaskEvent(SSE.taskProgress(def.id, 0, "Started", "running")),
          Effect.catchAll(() => Effect.void),
        )

        // Create timeout effect if specified
        const timeoutDuration = def.timeout ? Duration.decode(def.timeout) : null

        // Create retry schedule if specified
        const retrySchedule = def.retrySchedule ??
          (def.retries
            ? pipe(
                Schedule.exponential("100 millis"),
                Schedule.jittered,
                Schedule.intersect(Schedule.recurs(def.retries)),
              )
            : Schedule.stop)

        // Execute the task
        const taskEffect = pipe(
          def.effect,
          Effect.retry(retrySchedule),
          timeoutDuration
            ? Effect.timeout(timeoutDuration)
            : (e) => e,
          Effect.map((result) => (result === undefined ? null : result)),
        )

        yield* pipe(
          taskEffect,
          Effect.matchEffect({
            onSuccess: (taskResult) =>
              Effect.gen(function* () {
                const completedAt = new Date()
                yield* updateTaskInfo(def.id, {
                  status: "completed" as TaskStatus,
                  completedAt,
                  progress: 100,
                  result: taskResult,
                })
                yield* PubSub.publish(eventPubSub, { type: "completed", taskId: def.id, result: taskResult })
                yield* pipe(
                  broadcastTaskEvent(SSE.taskComplete(def.id, taskResult)),
                  Effect.catchAll(() => Effect.void),
                )
                yield* Deferred.succeed(deferred, taskResult)
              }),
            onFailure: (error) =>
              Effect.gen(function* () {
                const errorStr = String(error)
                const completedAt = new Date()
                yield* updateTaskInfo(def.id, {
                  status: "failed" as TaskStatus,
                  completedAt,
                  error: errorStr,
                })
                yield* PubSub.publish(eventPubSub, { type: "failed", taskId: def.id, error: errorStr })
                yield* pipe(
                  broadcastTaskEvent(SSE.taskComplete(def.id, undefined, errorStr)),
                  Effect.catchAll(() => Effect.void),
                )
                yield* Deferred.fail(
                  deferred,
                  new TaskError({
                    taskId: def.id,
                    type: "execution",
                    cause: error,
                    recovery: Recovery.escalate(errorStr, "TASK_FAILED"),
                  }),
                )
              }),
          }),
        )
      })

    // Worker loop - processes tasks from the queue
    const workerLoop: Effect.Effect<void, never> = Effect.gen(function* () {
      // Get next task
      const task = yield* Queue.take(taskQueue)

      yield* Ref.update(activeWorkers, (n) => n + 1)

      // Process the task
      yield* pipe(
        processTask(task),
        Effect.ensuring(Ref.update(activeWorkers, (n) => n - 1)),
      )

      // Continue processing
      yield* workerLoop
    })

    // Start worker fibers
    for (let i = 0; i < maxWorkers; i++) {
      yield* Effect.fork(workerLoop)
    }

    // Helper to create TaskHandle
    const createHandle = <A>(
      id: string,
      name: string,
      deferred: Deferred.Deferred<A, TaskError>,
    ): TaskHandle<A> => ({
      id,
      name,
      await: Deferred.await(deferred) as Effect.Effect<A, TaskError>,
      cancel: pipe(
        Effect.gen(function* () {
          const allTasks = yield* Ref.get(tasks)
          const task = HashMap.get(allTasks, id)
          if (task._tag === "None") return false

          const internalTask = task.value
          if (
            internalTask.info.status === "completed" ||
            internalTask.info.status === "failed" ||
            internalTask.info.status === "cancelled"
          ) {
            return false
          }

          if (internalTask.fiber) {
            yield* Fiber.interrupt(internalTask.fiber)
          }

          yield* updateTaskInfo(id, { status: "cancelled" as TaskStatus, completedAt: new Date() })
          yield* PubSub.publish(eventPubSub, { type: "cancelled", taskId: id })
          yield* pipe(
            broadcastTaskEvent(SSE.taskComplete(id, undefined, "Cancelled")),
            Effect.catchAll(() => Effect.void),
          )
          yield* Deferred.fail(
            deferred,
            new TaskError({
              taskId: id,
              type: "cancelled",
              recovery: Recovery.ignore(),
            }),
          )
          return true
        }),
        Effect.catchAll(() => Effect.succeed(false)),
      ),
      isRunning: Effect.gen(function* () {
        const allTasks = yield* Ref.get(tasks)
        const task = HashMap.get(allTasks, id)
        if (task._tag === "None") return false
        return task.value.info.status === "running" || task.value.info.status === "pending"
      }),
    })

    // Return the service API
    return {
      submit: <A, E>(def: TaskDef<A, E>) =>
        Effect.gen(function* () {
          const submittedAt = new Date()
          const deferred = yield* Deferred.make<A, TaskError>()

          const info: TaskInfo = {
            id: def.id,
            name: def.name,
            status: "pending",
            progress: 0,
            submittedAt,
            priority: def.priority ?? "normal",
            ...(def.metadata ? { metadata: def.metadata } : {}),
          }

          const internalTask: InternalTask = {
            info,
            deferred: deferred as Deferred.Deferred<unknown, TaskError>,
          }

          yield* Ref.update(tasks, HashMap.set(def.id, internalTask))
          yield* PubSub.publish(eventPubSub, { type: "submitted", task: info })

          // Add to queue
          yield* Queue.offer(taskQueue, {
            def: def as TaskDef<unknown, unknown>,
            deferred: deferred as Deferred.Deferred<unknown, TaskError>,
            submittedAt,
          })

          return createHandle(def.id, def.name, deferred)
        }),

      submitWithProgress: <A, E>(
        def: Omit<TaskDef<A, E>, "effect"> & {
          effect: (ctx: TaskProgressContext) => Effect.Effect<A, E>
        },
      ) =>
        Effect.gen(function* () {
          const submittedAt = new Date()
          const deferred = yield* Deferred.make<A, TaskError>()

          // Create progress context
          const progressCtx: TaskProgressContext = {
            taskId: def.id,
            progress: (percent, message, stage) =>
              pipe(
                Effect.gen(function* () {
                  const updates: Partial<TaskInfo> = {
                    progress: percent,
                    ...(message !== undefined ? { message } : {}),
                    ...(stage !== undefined ? { stage } : {}),
                  }
                  yield* updateTaskInfo(def.id, updates)

                  const event: TaskEvent = {
                    type: "progress",
                    taskId: def.id,
                    progress: percent,
                    ...(message !== undefined ? { message } : {}),
                    ...(stage !== undefined ? { stage } : {}),
                  } as TaskEvent
                  yield* PubSub.publish(eventPubSub, event)
                  yield* pipe(
                    broadcastTaskEvent(SSE.taskProgress(def.id, percent, message, stage)),
                    Effect.catchAll(() => Effect.void),
                  )
                }),
                Effect.catchAll(() => Effect.void),
              ),
          }

          // Wrap the effect with progress context
          const wrappedEffect = def.effect(progressCtx)

          const taskDef: TaskDef<A, E> = {
            ...def,
            effect: wrappedEffect,
          }

          const info: TaskInfo = {
            id: def.id,
            name: def.name,
            status: "pending",
            progress: 0,
            submittedAt,
            priority: def.priority ?? "normal",
            ...(def.metadata ? { metadata: def.metadata } : {}),
          }

          const internalTask: InternalTask = {
            info,
            deferred: deferred as Deferred.Deferred<unknown, TaskError>,
          }

          yield* Ref.update(tasks, HashMap.set(def.id, internalTask))
          yield* PubSub.publish(eventPubSub, { type: "submitted", task: info })

          yield* Queue.offer(taskQueue, {
            def: taskDef as TaskDef<unknown, unknown>,
            deferred: deferred as Deferred.Deferred<unknown, TaskError>,
            submittedAt,
          })

          return createHandle(def.id, def.name, deferred)
        }),

      cancel: (id: string) =>
        Effect.gen(function* () {
          const allTasks = yield* Ref.get(tasks)
          const task = HashMap.get(allTasks, id)

          if (task._tag === "None") {
            return yield* Effect.fail(
              new TaskError({
                taskId: id,
                type: "not_found",
                recovery: Recovery.ignore(),
              }),
            )
          }

          const internalTask = task.value
          if (
            internalTask.info.status === "completed" ||
            internalTask.info.status === "failed" ||
            internalTask.info.status === "cancelled"
          ) {
            return false
          }

          if (internalTask.fiber) {
            yield* Fiber.interrupt(internalTask.fiber)
          }

          yield* updateTaskInfo(id, { status: "cancelled" as TaskStatus, completedAt: new Date() })
          yield* PubSub.publish(eventPubSub, { type: "cancelled", taskId: id })
          yield* pipe(
            broadcastTaskEvent(SSE.taskComplete(id, undefined, "Cancelled")),
            Effect.catchAll(() => Effect.void),
          )

          return true
        }),

      get: (id: string) =>
        Effect.gen(function* () {
          const allTasks = yield* Ref.get(tasks)
          const task = HashMap.get(allTasks, id)
          return task._tag === "Some" ? task.value.info : null
        }),

      watch: (id: string) =>
        pipe(
          Stream.fromPubSub(eventPubSub),
          Stream.filter((event) => {
            if (event.type === "submitted") return event.task.id === id
            return "taskId" in event && event.taskId === id
          }),
          Stream.mapEffect(() =>
            Effect.gen(function* () {
              const allTasks = yield* Ref.get(tasks)
              const task = HashMap.get(allTasks, id)
              if (task._tag === "None") {
                return yield* Effect.fail(
                  new TaskError({
                    taskId: id,
                    type: "not_found",
                    recovery: Recovery.ignore(),
                  }),
                )
              }
              return task.value.info
            }),
          ),
        ),

      list: Effect.map(Ref.get(tasks), (map) =>
        Array.from(HashMap.values(map)).map((t) => t.info),
      ),

      listByStatus: (status: TaskStatus) =>
        Effect.map(Ref.get(tasks), (map) =>
          Array.from(HashMap.values(map))
            .filter((t) => t.info.status === status)
            .map((t) => t.info),
        ),

      reportProgress: (id: string, progress: number, message?: string, stage?: string) =>
        pipe(
          Effect.gen(function* () {
            const allTasks = yield* Ref.get(tasks)
            const task = HashMap.get(allTasks, id)

            if (task._tag === "None") {
              return yield* Effect.fail(
                new TaskError({
                  taskId: id,
                  type: "not_found",
                  recovery: Recovery.ignore(),
                }),
              )
            }

            const updates: Partial<TaskInfo> = {
              progress,
              ...(message !== undefined ? { message } : {}),
              ...(stage !== undefined ? { stage } : {}),
            }
            yield* updateTaskInfo(id, updates)

            const event: TaskEvent = {
              type: "progress",
              taskId: id,
              progress,
              ...(message !== undefined ? { message } : {}),
              ...(stage !== undefined ? { stage } : {}),
            } as TaskEvent
            yield* PubSub.publish(eventPubSub, event)
            yield* pipe(
              broadcastTaskEvent(SSE.taskProgress(id, progress, message, stage)),
              Effect.catchAll(() => Effect.void),
            )
          }),
          Effect.catchAll((e) => Effect.fail(e)),
        ),

      events: pipe(
        Stream.fromPubSub(eventPubSub),
        Stream.mapError(
          (cause) =>
            new TaskError({
              taskId: "events",
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

export type TaskServiceApi = Effect.Effect.Success<typeof TaskService>
