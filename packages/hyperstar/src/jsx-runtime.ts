/**
 * Hyperstar - JSX Runtime
 *
 * Thin wrapper around @kitajs/html that handles the $ prop for reactive attributes.
 * The $ prop accepts an HSBuilder instance which is converted to HTML attributes.
 *
 * @example
 * <button $={hs.action(increment)} class="btn">+1</button>
 */
import * as kita from "@kitajs/html/jsx-runtime"
import type { HSBuilder } from "./hs"

type Props = Record<string, unknown>

/**
 * Transform props by extracting HSBuilder attributes from the $ prop.
 */
function transformProps(props: Props): Props {
  if (!props) return props

  const result: Props = {}

  for (const [key, value] of Object.entries(props)) {
    if (key === "$" && value && typeof value === "object" && "_toAttrs" in value) {
      // Extract HSBuilder attributes and spread them
      const hsAttrs = (value as HSBuilder)._toAttrs()
      Object.assign(result, hsAttrs)
    } else {
      result[key] = value
    }
  }

  return result
}

export function jsx(
  type: string | Function,
  props: Props,
  key?: string,
): string | Promise<string> {
  const finalProps = transformProps(props)
  if (key !== undefined) finalProps.key = key
  return kita.jsx(type as string, finalProps)
}

export function jsxs(
  type: string | Function,
  props: Props,
  key?: string,
): string | Promise<string> {
  const finalProps = transformProps(props)
  if (key !== undefined) finalProps.key = key
  return kita.jsxs(type as string, finalProps as any)
}

export const jsxDEV = jsx
export { Fragment } from "@kitajs/html/jsx-runtime"
