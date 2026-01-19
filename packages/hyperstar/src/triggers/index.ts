/**
 * Hyperstar v3 - Trigger System (Simplified)
 *
 * Watch store changes and trigger handlers when values change.
 * Uses config objects - no builder pattern.
 */
import { Equal, HashMap, Option } from "effect"

// ============================================================================
// Handle Types
// ============================================================================

/**
 * Handle for controlling a trigger after it's registered.
 */
export interface TriggerHandle {
  readonly id: string
  /** Enable the trigger */
  enable(): void
  /** Disable the trigger */
  disable(): void
  /** Check if the trigger is enabled */
  readonly isEnabled: boolean
  /** Remove the trigger entirely */
  remove(): void
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context provided to trigger handlers.
 */
export interface TriggerContext<S extends object> {
  /** Update the global store */
  readonly update: (fn: (s: S) => S) => void
  /** Get the current store value */
  readonly getStore: () => S
}

/**
 * Context provided to user trigger handlers.
 */
export interface UserTriggerContext<S extends object, U extends object> {
  /** Update the global store */
  readonly update: (fn: (s: S) => S) => void
  /** Get the current store value */
  readonly getStore: () => S
  /** Update the user's store */
  readonly updateUser: (fn: (u: U) => U) => void
  /** Get the user's store */
  readonly getUserStore: () => U
  /** The session ID that triggered the change */
  readonly sessionId: string
}

/**
 * Change info passed to trigger handlers.
 */
export interface TriggerChange<T> {
  readonly oldValue: T
  readonly newValue: T
}

/**
 * Change info for user triggers.
 */
export interface UserTriggerChange<T> {
  readonly oldValue: T
  readonly newValue: T
  readonly sessionId: string
}

// ============================================================================
// Config Types
// ============================================================================

export interface TriggerConfig<S extends object, T> {
  id: string
  watch?: (s: S) => T
  handler: (ctx: TriggerContext<S>, change: TriggerChange<T>) => void
}

export interface UserTriggerConfig<S extends object, U extends object, T> {
  id: string
  watch?: (u: U) => T
  handler: (ctx: UserTriggerContext<S, U>, change: UserTriggerChange<T>) => void
}

// ============================================================================
// Trigger Registry
// ============================================================================

/**
 * Registry for managing triggers.
 * Handles store/userStore update interception and trigger execution.
 */
interface TriggerEntry<S extends object> {
  config: TriggerConfig<S, any>
  enabled: boolean
  lastValue: any
}

interface UserTriggerEntry<S extends object, U extends object> {
  config: UserTriggerConfig<S, U, any>
  enabled: boolean
  lastValues: HashMap.HashMap<string, any>
}

export class TriggerRegistry<S extends object, U extends object> {
  private triggers: HashMap.HashMap<string, TriggerEntry<S>> = HashMap.empty()

  private userTriggers: HashMap.HashMap<string, UserTriggerEntry<S, U>> = HashMap.empty()

  constructor(
    private readonly getStore: () => S,
    private readonly updateStore: (fn: (s: S) => S) => void,
    private readonly getUserStoreById: (sessionId: string) => U | undefined,
    private readonly updateUserStoreById: (sessionId: string, fn: (u: U) => U) => void,
  ) {}

  /**
   * Register a store trigger.
   */
  registerTrigger(config: TriggerConfig<S, any>): TriggerHandle {
    const store = this.getStore()
    const initialValue = config.watch ? config.watch(store) : store

    console.log(`🎯 [Trigger:${config.id}] Registered (watching: ${config.watch ? "selector" : "full store"})`)

    this.triggers = HashMap.set(this.triggers, config.id, {
      config,
      enabled: true,
      lastValue: initialValue,
    })

    return this.createHandle(config.id, "store")
  }

  /**
   * Register a user store trigger.
   */
  registerUserTrigger(config: UserTriggerConfig<S, U, any>): TriggerHandle {
    console.log(`🎯 [UserTrigger:${config.id}] Registered (watching: ${config.watch ? "selector" : "full userStore"})`)

    this.userTriggers = HashMap.set(this.userTriggers, config.id, {
      config,
      enabled: true,
      lastValues: HashMap.empty(),
    })

    return this.createHandle(config.id, "user")
  }

  /**
   * Call this after a store update to check and fire triggers.
   */
  onStoreUpdate(oldStore: S, newStore: S): void {
    HashMap.forEach(this.triggers, (trigger, id) => {
      if (!trigger.enabled) return

      const oldValue = trigger.config.watch ? trigger.config.watch(oldStore) : oldStore
      const newValue = trigger.config.watch ? trigger.config.watch(newStore) : newStore

      if (!this.isEqual(oldValue, newValue)) {
        console.log(`🎯 [Trigger:${id}] Fired (${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)})`)
        const ctx: TriggerContext<S> = {
          update: this.updateStore,
          getStore: this.getStore,
        }

        trigger.config.handler(ctx, { oldValue, newValue })
        this.triggers = HashMap.set(this.triggers, id, { ...trigger, lastValue: newValue })
      }
    })
  }

  /**
   * Call this after a user store update to check and fire user triggers.
   */
  onUserStoreUpdate(sessionId: string, oldUserStore: U, newUserStore: U): void {
    HashMap.forEach(this.userTriggers, (trigger, id) => {
      if (!trigger.enabled) return

      const oldValue = trigger.config.watch ? trigger.config.watch(oldUserStore) : oldUserStore
      const newValue = trigger.config.watch ? trigger.config.watch(newUserStore) : newUserStore

      if (!this.isEqual(oldValue, newValue)) {
        console.log(`🎯 [UserTrigger:${id}] Fired for session ${sessionId.slice(0, 8)}...`)
        const ctx: UserTriggerContext<S, U> = {
          update: this.updateStore,
          getStore: this.getStore,
          updateUser: (fn) => this.updateUserStoreById(sessionId, fn),
          getUserStore: () => this.getUserStoreById(sessionId)!,
          sessionId,
        }

        trigger.config.handler(ctx, { oldValue, newValue, sessionId })
        const updatedLastValues = HashMap.set(trigger.lastValues, sessionId, newValue)
        this.userTriggers = HashMap.set(this.userTriggers, id, { ...trigger, lastValues: updatedLastValues })
      }
    })
  }

  /**
   * Remove all triggers (for cleanup).
   */
  clear(): void {
    this.triggers = HashMap.empty()
    this.userTriggers = HashMap.empty()
  }

  private createHandle(id: string, type: "store" | "user"): TriggerHandle {
    const self = this

    return {
      id,
      get isEnabled() {
        if (type === "store") {
          return Option.getOrElse(
            Option.map(HashMap.get(self.triggers, id), (t) => t.enabled),
            () => false
          )
        } else {
          return Option.getOrElse(
            Option.map(HashMap.get(self.userTriggers, id), (t) => t.enabled),
            () => false
          )
        }
      },
      enable() {
        if (type === "store") {
          Option.map(HashMap.get(self.triggers, id), (trigger) => {
            self.triggers = HashMap.set(self.triggers, id, { ...trigger, enabled: true })
          })
        } else {
          Option.map(HashMap.get(self.userTriggers, id), (trigger) => {
            self.userTriggers = HashMap.set(self.userTriggers, id, { ...trigger, enabled: true })
          })
        }
      },
      disable() {
        if (type === "store") {
          Option.map(HashMap.get(self.triggers, id), (trigger) => {
            self.triggers = HashMap.set(self.triggers, id, { ...trigger, enabled: false })
          })
        } else {
          Option.map(HashMap.get(self.userTriggers, id), (trigger) => {
            self.userTriggers = HashMap.set(self.userTriggers, id, { ...trigger, enabled: false })
          })
        }
      },
      remove() {
        if (type === "store") {
          self.triggers = HashMap.remove(self.triggers, id)
        } else {
          self.userTriggers = HashMap.remove(self.userTriggers, id)
        }
      },
    }
  }

  private isEqual(a: unknown, b: unknown): boolean {
    return Equal.equals(a, b)
  }
}
