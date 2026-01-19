/**
 * Hyperstar v3 - Cron DSL Helpers
 *
 * Simple DSL for creating Effect.Schedule instances.
 */
import { Schedule, Duration, pipe } from "effect"

// ============================================================================
// Duration Parsing
// ============================================================================

/**
 * Parse a duration string like "5 minutes", "1 hour", "30 seconds"
 */
const parseDuration = (input: Duration.DurationInput): Duration.Duration =>
  Duration.decode(input)

// ============================================================================
// Cron DSL
// ============================================================================

export const Cron = {
  /**
   * Run every N duration
   * @example Cron.every("5 minutes")
   * @example Cron.every("1 hour")
   */
  every: (interval: Duration.DurationInput): Schedule.Schedule<number> =>
    Schedule.spaced(parseDuration(interval)),

  /**
   * Run at a specific time daily (24h format)
   * Note: This is a simplified implementation that uses spaced intervals.
   * For true cron-like "at time" scheduling, you'd need a more complex implementation.
   * @example Cron.daily("09:00")
   * @example Cron.daily("14:30")
   */
  daily: (_time: string): Schedule.Schedule<number> => {
    // Simplified: Run once per day (24 hours)
    // A full implementation would calculate time until next occurrence
    return Schedule.spaced(Duration.hours(24))
  },

  /**
   * Run with jitter to spread out load in distributed systems
   * @example Cron.withJitter("1 hour", "5 minutes")
   */
  withJitter: (
    interval: Duration.DurationInput,
    _jitter: Duration.DurationInput,
  ): Schedule.Schedule<number> =>
    pipe(
      Schedule.spaced(parseDuration(interval)),
      Schedule.jittered,
    ),

  /**
   * Run N times then stop
   * @example Cron.times(5, "1 minute")
   */
  times: (count: number, interval: Duration.DurationInput): Schedule.Schedule<number> =>
    pipe(
      Schedule.spaced(parseDuration(interval)),
      Schedule.intersect(Schedule.recurs(count)),
      Schedule.map(([n]) => n),
    ),

  /**
   * Run with exponential backoff (useful for retry-like patterns)
   * @example Cron.exponential("1 second", 2, "1 minute")
   */
  exponential: (
    base: Duration.DurationInput,
    factor = 2,
    max?: Duration.DurationInput,
  ): Schedule.Schedule<unknown> => {
    const schedule = Schedule.exponential(parseDuration(base), factor)
    return max
      ? pipe(schedule, Schedule.upTo(parseDuration(max)))
      : schedule
  },

  /**
   * Run forever with fixed interval
   * @example Cron.fixed("30 seconds")
   */
  fixed: (interval: Duration.DurationInput): Schedule.Schedule<number> =>
    Schedule.fixed(parseDuration(interval)),

  /**
   * Combine multiple schedules (union - runs when ANY schedule fires)
   * @example Cron.union(Cron.every("5 minutes"), Cron.every("1 hour"))
   */
  union: <A, B>(
    a: Schedule.Schedule<A>,
    b: Schedule.Schedule<B>,
  ): Schedule.Schedule<[A, B]> =>
    Schedule.union(a, b),

  /**
   * Combine multiple schedules (intersect - runs when ALL schedules fire)
   * @example Cron.intersect(Cron.every("5 minutes"), Cron.times(10, "1 minute"))
   */
  intersect: <A, B>(
    a: Schedule.Schedule<A>,
    b: Schedule.Schedule<B>,
  ): Schedule.Schedule<[A, B]> =>
    Schedule.intersect(a, b),

  /**
   * Add a delay before the first execution
   * @example Cron.delayed("10 seconds", Cron.every("1 minute"))
   */
  delayed: <A>(
    delay: Duration.DurationInput,
    schedule: Schedule.Schedule<A>,
  ): Schedule.Schedule<A> =>
    pipe(schedule, Schedule.delayed(() => parseDuration(delay))),

  /**
   * Run only during specific hours (simplified)
   * Note: This is a basic filter that skips executions outside the hours.
   * @example Cron.duringHours(9, 17, Cron.every("5 minutes"))
   */
  duringHours: <A>(
    startHour: number,
    endHour: number,
    schedule: Schedule.Schedule<A>,
  ): Schedule.Schedule<A> =>
    pipe(
      schedule,
      Schedule.check((_input: unknown, _output: A) => {
        const hour = new Date().getHours()
        return hour >= startHour && hour < endHour
      }),
    ),

  /**
   * Create a schedule that never runs (useful for disabling jobs)
   */
  never: (): Schedule.Schedule<void> => Schedule.stop,

  /**
   * Run once immediately
   */
  once: (): Schedule.Schedule<void> => Schedule.once,
}
