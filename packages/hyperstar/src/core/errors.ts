/**
 * Hyperstar v3 - Typed Errors with Recovery Hints
 *
 * All errors are Data.TaggedError with explicit recovery guidance.
 * AI agents can pattern match on errors and auto-remediate.
 */
import { Data, Match, Effect, Duration, Schedule } from "effect"

// ============================================================================
// Recovery Hints - Guide AI agents on how to handle errors
// ============================================================================

/**
 * Recovery hints tell AI agents (and error handlers) how to recover from errors.
 * This enables automatic retry logic, fallback behavior, and escalation paths.
 */
export type RecoveryHint = Data.TaggedEnum<{
  /** Retry the operation with exponential backoff */
  Retry: {
    readonly delay: Duration.DurationInput
    readonly maxAttempts: number
  }
  /** Use a fallback value instead of failing */
  Fallback: {
    readonly value: unknown
  }
  /** Escalate to user/operator - cannot auto-recover */
  Escalate: {
    readonly message: string
    readonly code: string
  }
  /** Safe to ignore this error */
  Ignore: {
    readonly _ignored?: undefined
  }
}>

export const RecoveryHint = Data.taggedEnum<RecoveryHint>()

/** Helper constructors for common recovery patterns */
export const Recovery = {
  /** Retry with default settings: 100ms delay, 3 attempts */
  retry: (delay: Duration.DurationInput = "100 millis", maxAttempts = 3) =>
    RecoveryHint.Retry({ delay, maxAttempts }),

  /** Use a fallback value */
  fallback: <T>(value: T) => RecoveryHint.Fallback({ value }),

  /** Escalate with message and code */
  escalate: (message: string, code: string) =>
    RecoveryHint.Escalate({ message, code }),

  /** Safe to ignore */
  ignore: () => RecoveryHint.Ignore({}),
}

// ============================================================================
// Typed Errors - All errors extend Data.TaggedError
// ============================================================================

/**
 * Store operation errors
 */
export class StoreError extends Data.TaggedError("StoreError")<{
  readonly operation: "read" | "write" | "subscribe"
  readonly cause: unknown
  readonly recovery: RecoveryHint
}> {}

/**
 * Action execution errors
 */
export class ActionError extends Data.TaggedError("ActionError")<{
  readonly actionId: string
  readonly phase: "validation" | "execution" | "effect"
  readonly cause: unknown
  readonly recovery: RecoveryHint
}> {}

/**
 * Schema validation errors
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
  readonly value: unknown
  readonly recovery: RecoveryHint
}> {}

/**
 * SSE connection errors
 */
export class SSEError extends Data.TaggedError("SSEError")<{
  readonly type: "connection" | "timeout" | "parse" | "broadcast"
  readonly cause: unknown
  readonly recovery: RecoveryHint
}> {}

/**
 * Session errors
 */
export class SessionError extends Data.TaggedError("SessionError")<{
  readonly type: "expired" | "invalid" | "missing"
  readonly sessionId: string | null
  readonly recovery: RecoveryHint
}> {}

/**
 * Signal errors
 */
export class SignalError extends Data.TaggedError("SignalError")<{
  readonly signalName: string
  readonly operation: "get" | "set" | "subscribe"
  readonly cause: unknown
  readonly recovery: RecoveryHint
}> {}

/**
 * Render errors
 */
export class RenderError extends Data.TaggedError("RenderError")<{
  readonly component: string
  readonly cause: unknown
  readonly recovery: RecoveryHint
}> {}

/**
 * Task errors
 */
export class TaskError extends Data.TaggedError("TaskError")<{
  readonly taskId: string
  readonly type: "timeout" | "cancelled" | "execution" | "not_found"
  readonly cause?: unknown
  readonly recovery: RecoveryHint
}> {}

/**
 * Schedule errors
 */
export class ScheduleError extends Data.TaggedError("ScheduleError")<{
  readonly jobId: string
  readonly type: "invalid_schedule" | "execution" | "not_found" | "already_running"
  readonly cause?: unknown
  readonly recovery: RecoveryHint
}> {}

// ============================================================================
// Union Type for All App Errors
// ============================================================================

export type AppError =
  | StoreError
  | ActionError
  | ValidationError
  | SSEError
  | SessionError
  | SignalError
  | RenderError
  | TaskError
  | ScheduleError

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Create an Effect retry schedule from a RecoveryHint
 */
export const scheduleFromRecovery = (hint: RecoveryHint) =>
  RecoveryHint.$match(hint, {
    Retry: ({ delay, maxAttempts }) =>
      Schedule.exponential(delay).pipe(
        Schedule.jittered,
        Schedule.upTo(Duration.times(Duration.decode(delay), maxAttempts * 2)),
      ),
    Fallback: () => Schedule.stop,
    Escalate: () => Schedule.stop,
    Ignore: () => Schedule.stop,
  })

/**
 * Apply recovery strategy to an Effect
 */
export const applyRecovery = <A, R>(
  effect: Effect.Effect<A, AppError, R>,
  onFallback: (value: unknown) => A,
): Effect.Effect<A, AppError, R> =>
  Effect.catchAll(effect, (error) =>
    RecoveryHint.$match(error.recovery, {
      Retry: ({ delay, maxAttempts }) =>
        Effect.retry(
          effect,
          Schedule.exponential(delay).pipe(
            Schedule.jittered,
            Schedule.intersect(Schedule.recurs(maxAttempts)),
          ),
        ),
      Fallback: ({ value }) => Effect.succeed(onFallback(value)),
      Escalate: () => Effect.fail(error),
      Ignore: () => Effect.succeed(onFallback(undefined)),
    }),
  )

/**
 * Exhaustive error handler - AI must handle all error types
 */
export const handleAppError = <A, R>(handlers: {
  StoreError: (e: StoreError) => Effect.Effect<A, never, R>
  ActionError: (e: ActionError) => Effect.Effect<A, never, R>
  ValidationError: (e: ValidationError) => Effect.Effect<A, never, R>
  SSEError: (e: SSEError) => Effect.Effect<A, never, R>
  SessionError: (e: SessionError) => Effect.Effect<A, never, R>
  SignalError: (e: SignalError) => Effect.Effect<A, never, R>
  RenderError: (e: RenderError) => Effect.Effect<A, never, R>
  TaskError: (e: TaskError) => Effect.Effect<A, never, R>
  ScheduleError: (e: ScheduleError) => Effect.Effect<A, never, R>
}) =>
  Match.type<AppError>().pipe(
    Match.tag("StoreError", handlers.StoreError),
    Match.tag("ActionError", handlers.ActionError),
    Match.tag("ValidationError", handlers.ValidationError),
    Match.tag("SSEError", handlers.SSEError),
    Match.tag("SessionError", handlers.SessionError),
    Match.tag("SignalError", handlers.SignalError),
    Match.tag("RenderError", handlers.RenderError),
    Match.tag("TaskError", handlers.TaskError),
    Match.tag("ScheduleError", handlers.ScheduleError),
    Match.exhaustive,
  )

/**
 * Log error with full context for debugging
 */
export const logError = (error: AppError): Effect.Effect<void> =>
  Effect.logError(`[${error._tag}]`, {
    ...error,
    recovery: RecoveryHint.$match(error.recovery, {
      Retry: (r) => `Retry(${r.maxAttempts}x, ${r.delay})`,
      Fallback: (f) => `Fallback(${JSON.stringify(f.value)})`,
      Escalate: (e) => `Escalate(${e.code}: ${e.message})`,
      Ignore: () => "Ignore",
    }),
  })
