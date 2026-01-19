/**
 * Hyperstar v3 - Signals Module
 *
 * Re-exports all signal types and the Signal namespace.
 */

export {
  // Definition types
  type SignalScope,
  type SignalDef,
  type BooleanSignalDef,
  type NumberSignalDef,
  type StringSignalDef,
  type EnumSignalDef,
  type NullableSignalDef,
  type AnySignalDef,
  // Accessor types
  type SignalAccessor,
  type BooleanSignalAccessor,
  type NumberSignalAccessor,
  type StringSignalAccessor,
  type EnumSignalAccessor,
  type NullableSignalAccessor,
  // Protocol
  type SignalProtocol,
  // Namespace
  Signal,
} from "./protocol"
