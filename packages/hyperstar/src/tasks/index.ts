/**
 * Hyperstar v3 - Tasks Module
 *
 * Background task execution with priority queuing.
 * Uses Effect.Service pattern for simplified service definition.
 */
export {
  type TaskPriority,
  type TaskDef,
  type TaskHandle,
  type TaskStatus,
  type TaskInfo,
  type TaskProgressContext,
  type TaskServiceApi,
  type TaskEvent,
  TaskService,
} from "./service"
