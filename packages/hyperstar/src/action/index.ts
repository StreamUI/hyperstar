/**
 * Hyperstar v3 - Action Module
 *
 * Minimal exports for the simplified action API.
 */

export {
  // Context types
  type ActionContext,
  type SimplifiedActionContext,
  type SimplifiedHeadService,
  type HeadServiceApi,
  // Descriptor type
  type ActionDescriptor,
  // Minimal action type for component props
  type Action,
  // Internal helpers (used by server.ts)
  createSimplifiedContext,
  createNoArgsAction,
  createWithArgsAction,
} from "./schema"
