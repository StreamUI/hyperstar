/**
 * Hyperstar v3 - Typed Signal Protocol
 *
 * Signals are client-side reactive state with explicit scope and type safety.
 * The protocol defines what signals exist and their types at compile time.
 */
import { Schema } from "effect"
import { Expression, expr } from "../ui/nodes"

// ============================================================================
// Signal Definition Types
// ============================================================================

/**
 * Signal scope determines where the signal lives and how it syncs
 */
export type SignalScope =
  | "client" // Client-only, never sent to server
  | "sync" // Synced with server on every action
  | "action" // Only sent when explicitly included in action args

/**
 * Base signal definition
 */
export interface SignalDef<T> {
  readonly _tag: "SignalDef"
  readonly default: T
  readonly scope: SignalScope
  readonly schema: Schema.Schema<T>
}

/**
 * Boolean signal with convenience methods
 */
export interface BooleanSignalDef extends SignalDef<boolean> {
  readonly type: "boolean"
}

/**
 * Number signal with convenience methods
 */
export interface NumberSignalDef extends SignalDef<number> {
  readonly type: "number"
}

/**
 * String signal
 */
export interface StringSignalDef<T extends string = string> extends SignalDef<T> {
  readonly type: "string"
}

/**
 * Enum signal (string literal union)
 */
export interface EnumSignalDef<T extends string> extends SignalDef<T> {
  readonly type: "enum"
  readonly values: readonly T[]
}

/**
 * Nullable signal
 */
export interface NullableSignalDef<T> extends SignalDef<T | null> {
  readonly type: "nullable"
}

/**
 * Union of all signal definition types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySignalDef =
  | BooleanSignalDef
  | NumberSignalDef
  | StringSignalDef
  | EnumSignalDef<string>
  | NullableSignalDef<any>

// ============================================================================
// Signal Accessors (Runtime)
// ============================================================================

/**
 * Runtime signal accessor with reactive helpers
 */
export interface SignalAccessor<T> {
  /** Signal name */
  readonly name: string
  /** Default value */
  readonly default: T
  /** Get expression for this signal's value */
  readonly expr: Expression
  /** Set signal to value (returns expression) */
  set(value: T): Expression
  /** Check if signal equals value */
  is(value: T): Expression
  /** Check if signal does not equal value */
  isNot(value: T): Expression
  /** Create a patch object for this signal */
  patch(value: T): Record<string, T>
}

/**
 * Boolean signal accessor with toggle helpers
 */
export interface BooleanSignalAccessor extends SignalAccessor<boolean> {
  toggle(): Expression
  setTrue(): Expression
  setFalse(): Expression
}

/**
 * Number signal accessor with arithmetic helpers
 */
export interface NumberSignalAccessor extends SignalAccessor<number> {
  add(n: number): Expression
  increment(): Expression
  decrement(): Expression
  gt(n: number): Expression
  gte(n: number): Expression
  lt(n: number): Expression
  lte(n: number): Expression
}

/**
 * String signal accessor
 */
export interface StringSignalAccessor<T extends string = string>
  extends SignalAccessor<T> {
  isEmpty(): Expression
  isNotEmpty(): Expression
  /** Parse as integer with optional fallback (defaults to 0) */
  toInt(fallback?: number): Expression
  /** Get trimmed value */
  trimmed(): Expression
}

/**
 * Enum signal accessor
 */
export interface EnumSignalAccessor<T extends string>
  extends SignalAccessor<T> {
  readonly values: readonly T[]
}

/**
 * Nullable signal accessor
 */
export interface NullableSignalAccessor<T> extends SignalAccessor<T | null> {
  clear(): Expression
  isSet(): Expression
  isNull(): Expression
}

// ============================================================================
// Signal Factory Functions
// ============================================================================

const createBooleanAccessor = (
  name: string,
  defaultValue: boolean,
): BooleanSignalAccessor => ({
  name,
  default: defaultValue,
  expr: expr(`$${name}.value`),
  set: (v) => expr(`$${name}.value = ${v}`),
  is: (v) => expr(`$${name}.value === ${v}`),
  isNot: (v) => expr(`$${name}.value !== ${v}`),
  patch: (v) => ({ [name]: v }),
  toggle: () => expr(`$${name}.value = !$${name}.value`),
  setTrue: () => expr(`$${name}.value = true`),
  setFalse: () => expr(`$${name}.value = false`),
})

const createNumberAccessor = (
  name: string,
  defaultValue: number,
): NumberSignalAccessor => ({
  name,
  default: defaultValue,
  expr: expr(`$${name}.value`),
  set: (v) => expr(`$${name}.value = ${v}`),
  is: (v) => expr(`$${name}.value === ${v}`),
  isNot: (v) => expr(`$${name}.value !== ${v}`),
  patch: (v) => ({ [name]: v }),
  add: (n) => expr(`$${name}.value += ${n}`),
  increment: () => expr(`$${name}.value++`),
  decrement: () => expr(`$${name}.value--`),
  gt: (n) => expr(`$${name}.value > ${n}`),
  gte: (n) => expr(`$${name}.value >= ${n}`),
  lt: (n) => expr(`$${name}.value < ${n}`),
  lte: (n) => expr(`$${name}.value <= ${n}`),
})

const createStringAccessor = <T extends string>(
  name: string,
  defaultValue: T,
): StringSignalAccessor<T> => ({
  name,
  default: defaultValue,
  expr: expr(`$${name}.value`),
  set: (v) => expr(`$${name}.value = '${v}'`),
  is: (v) => expr(`$${name}.value === '${v}'`),
  isNot: (v) => expr(`$${name}.value !== '${v}'`),
  patch: (v) => ({ [name]: v }),
  isEmpty: () => expr(`$${name}.value === ''`),
  isNotEmpty: () => expr(`$${name}.value !== ''`),
  toInt: (fallback = 0) => expr(`parseInt($${name}.value) || ${fallback}`),
  trimmed: () => expr(`$${name}.value.trim()`),
})

const createEnumAccessor = <T extends string>(
  name: string,
  values: readonly T[],
  defaultValue: T,
): EnumSignalAccessor<T> => ({
  name,
  default: defaultValue,
  values,
  expr: expr(`$${name}.value`),
  set: (v) => expr(`$${name}.value = '${v}'`),
  is: (v) => expr(`$${name}.value === '${v}'`),
  isNot: (v) => expr(`$${name}.value !== '${v}'`),
  patch: (v) => ({ [name]: v }),
})

const createNullableAccessor = <T>(
  name: string,
): NullableSignalAccessor<T> => ({
  name,
  default: null,
  expr: expr(`$${name}.value`),
  set: (v) => expr(`$${name}.value = ${JSON.stringify(v)}`),
  is: (v) => expr(`$${name}.value === ${JSON.stringify(v)}`),
  isNot: (v) => expr(`$${name}.value !== ${JSON.stringify(v)}`),
  patch: (v) => ({ [name]: v }),
  clear: () => expr(`$${name}.value = null`),
  isSet: () => expr(`$${name}.value !== null`),
  isNull: () => expr(`$${name}.value === null`),
})

// ============================================================================
// Signal Definition Helpers
// ============================================================================

/**
 * Define a boolean signal
 */
const boolean = (config: {
  default?: boolean
  scope?: SignalScope
} = {}): BooleanSignalDef => ({
  _tag: "SignalDef",
  type: "boolean",
  default: config.default ?? false,
  scope: config.scope ?? "client",
  schema: Schema.Boolean,
})

/**
 * Define a number signal
 */
const number = (config: {
  default?: number
  scope?: SignalScope
} = {}): NumberSignalDef => ({
  _tag: "SignalDef",
  type: "number",
  default: config.default ?? 0,
  scope: config.scope ?? "client",
  schema: Schema.Number,
})

/**
 * Define a string signal
 */
const string = <T extends string = string>(config: {
  default?: T
  scope?: SignalScope
} = {}): StringSignalDef<T> => ({
  _tag: "SignalDef",
  type: "string",
  default: (config.default ?? "") as T,
  scope: config.scope ?? "sync",
  schema: Schema.String as unknown as Schema.Schema<T>,
})

/**
 * Define an enum signal
 */
const enumSignal = <T extends string>(
  values: readonly T[],
  config: {
    default?: T
    scope?: SignalScope
  } = {},
): EnumSignalDef<T> => ({
  _tag: "SignalDef",
  type: "enum",
  values,
  default: config.default ?? values[0]!,
  scope: config.scope ?? "client",
  schema: Schema.Literal(...values) as unknown as Schema.Schema<T>,
})

/**
 * Define a nullable signal
 */
const nullable = <T>(config: {
  scope?: SignalScope
} = {}): NullableSignalDef<T> => ({
  _tag: "SignalDef",
  type: "nullable",
  default: null,
  scope: config.scope ?? "client",
  schema: Schema.NullOr(Schema.Unknown) as Schema.Schema<T | null>,
})

// ============================================================================
// Signal Protocol Definition
// ============================================================================

type SignalProtocolDef = Record<string, AnySignalDef>

/**
 * Infer accessor types from signal definitions
 */
type InferAccessor<D extends AnySignalDef> = D extends BooleanSignalDef
  ? BooleanSignalAccessor
  : D extends NumberSignalDef
    ? NumberSignalAccessor
    : D extends EnumSignalDef<infer T>
      ? EnumSignalAccessor<T>
      : D extends StringSignalDef<infer T>
        ? StringSignalAccessor<T>
        : D extends NullableSignalDef<infer T>
          ? NullableSignalAccessor<T>
          : SignalAccessor<unknown>

type InferAccessors<P extends SignalProtocolDef> = {
  [K in keyof P]: InferAccessor<P[K]>
}

/**
 * A signal protocol with typed accessors
 */
export interface SignalProtocol<P extends SignalProtocolDef> {
  readonly definitions: P
  readonly accessors: InferAccessors<P>
  readonly defaults: { [K in keyof P]: P[K]["default"] }
}

/**
 * Define a signal protocol
 *
 * @example
 * ```typescript
 * const signals = Signal.protocol({
 *   isModalOpen: Signal.boolean(),
 *   activeTab: Signal.enum(["home", "about", "contact"]),
 *   searchQuery: Signal.string({ scope: "sync" }),
 *   selectedId: Signal.nullable<string>(),
 * })
 *
 * // Use in views:
 * signals.accessors.isModalOpen.toggle() // Expression
 * signals.accessors.activeTab.is("home") // Expression
 * ```
 */
const protocol = <P extends SignalProtocolDef>(
  definitions: P,
): SignalProtocol<P> => {
  const accessors = {} as Record<string, SignalAccessor<unknown>>
  const defaults = {} as Record<string, unknown>

  for (const [name, def] of Object.entries(definitions)) {
    defaults[name] = def.default

    switch (def.type) {
      case "boolean":
        accessors[name] = createBooleanAccessor(name, def.default)
        break
      case "number":
        accessors[name] = createNumberAccessor(name, def.default)
        break
      case "string":
        accessors[name] = createStringAccessor(name, def.default)
        break
      case "enum":
        accessors[name] = createEnumAccessor(
          name,
          (def as EnumSignalDef<string>).values,
          def.default,
        )
        break
      case "nullable":
        accessors[name] = createNullableAccessor(name)
        break
    }
  }

  return {
    definitions,
    accessors: accessors as InferAccessors<P>,
    defaults: defaults as { [K in keyof P]: P[K]["default"] },
  }
}

// ============================================================================
// Signal Namespace
// ============================================================================

export const Signal = {
  boolean,
  number,
  string,
  enum: enumSignal,
  nullable,
  protocol,
}
