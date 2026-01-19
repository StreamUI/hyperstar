/**
 * Hyperstar v3 - Core Module
 *
 * Re-exports all core types, services, and layers.
 */

// Errors and Recovery
export {
  RecoveryHint,
  Recovery,
  StoreError,
  ActionError,
  ValidationError,
  SSEError,
  SessionError,
  SignalError,
  RenderError,
  TaskError,
  ScheduleError,
  type AppError,
  scheduleFromRecovery,
  applyRecovery,
  handleAppError,
  logError,
} from "./errors"

// Services
export {
  type Session,
  SessionService,
  type StoreServiceApi,
  StoreService,
  getStoreService,
  type UserStoreServiceApi,
  UserStoreService,
  getUserStoreService,
  // Schema-defined SSE events (value exports include companion types)
  SSEMorphEvent,
  SSESignalsEvent,
  SSEExecuteEvent,
  SSERedirectEvent,
  SSEErrorEvent,
  SSETitleEvent,
  SSEFaviconEvent,
  SSETaskProgressEvent,
  SSETaskCompleteEvent,
  SSEEventSchema,
  type SSEEventTyped,
  SSE,
  // Legacy SSE types (deprecated)
  type SSEEvent,
  type SSEClient,
  type SSEServiceApi,
  SSEService,
  type SignalPatch,
  type SignalServiceApi,
  SignalService,
  type ActionMeta,
  type ActionRegistryApi,
  ActionRegistry,
  type RenderServiceApi,
  RenderService,
  type AppServices,
} from "./services"

// Layers
export {
  makeStoreLayer,
  makeUserStoreLayer,
  SSELayer,
  makeSignalLayer,
  ActionRegistryLayer,
  makeAppLayers,
} from "./layers"

// Lifecycle
export {
  type TickContext,
  type StopFn,
  type CancelFn,
  type LifecycleContext,
  type TimerHandlerContext,
  type TimerConfig,
  type ManagedTimer,
  createLifecycleContext,
  createManagedTimer,
} from "./lifecycle"
