/**
 * Hyperstar JSX Type Definitions
 *
 * Extends Kita's JSX types to add:
 * - The $ prop for reactive attributes (HSBuilder)
 * - Expr type for hs-* attributes (eliminates .toString() calls)
 */
import type { HSBuilder } from "./hs"
import type { Expr } from "./server"

/**
 * Hyperstar reactive attribute value type.
 * Accepts Expr objects directly, eliminating the need for .toString().
 */
type HsAttrValue = string | Expr

declare global {
  namespace JSX {
    // Base Hyperstar props available on all elements
    interface HyperstarProps {
      /** Hyperstar reactive attributes builder */
      $?: HSBuilder
      /** Show/hide element based on expression */
      "hs-show"?: HsAttrValue
      /** Bind signal to input value */
      "hs-bind"?: string
      /** Set text content from expression */
      "hs-text"?: HsAttrValue
      /** Initialize signals from JSON */
      "hs-signals"?: string
      /** Initialization expression */
      "hs-init"?: string
    }

    // Add $ prop and hs-* attributes to all HTML elements
    interface HtmlTag extends HyperstarProps {}

    interface HtmlButtonTag extends HyperstarProps {}

    interface HtmlFormTag extends HyperstarProps {}

    interface HtmlInputTag extends HyperstarProps {}

    interface HtmlSelectTag extends HyperstarProps {}

    interface HtmlTextareaTag extends HyperstarProps {}

    interface HtmlAnchorTag extends HyperstarProps {}

    interface HtmlDivTag extends HyperstarProps {}

    interface HtmlSpanTag extends HyperstarProps {}

    interface HtmlLabelTag extends HyperstarProps {}

    interface HtmlImgTag extends HyperstarProps {}

    interface HtmlTableTag extends HyperstarProps {}

    interface HtmlTableRowTag extends HyperstarProps {}

    interface HtmlTableCellTag extends HyperstarProps {}

    interface HtmlListTag extends HyperstarProps {}

    interface HtmlListItemTag extends HyperstarProps {}

    interface HtmlHeadingTag extends HyperstarProps {}

    interface HtmlParagraphTag extends HyperstarProps {}

    interface HtmlSectionTag extends HyperstarProps {}

    interface HtmlArticleTag extends HyperstarProps {}

    interface HtmlNavTag extends HyperstarProps {}

    interface HtmlHeaderTag extends HyperstarProps {}

    interface HtmlFooterTag extends HyperstarProps {}

    interface HtmlMainTag extends HyperstarProps {}

    interface HtmlAsideTag extends HyperstarProps {}

    // Allow hs-on:*, hs-class:*, hs-attr:* dynamic attributes
    // These can't be strictly typed but we allow them via index signature on intrinsic elements
    interface IntrinsicAttributes extends HyperstarProps {}
  }
}

export {}
