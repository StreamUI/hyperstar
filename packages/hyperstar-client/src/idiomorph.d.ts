/**
 * Type declarations for idiomorph
 */
declare module "idiomorph" {
  export interface IdiomorphCallbacks {
    beforeNodeAdded?: (node: Node) => boolean;
    afterNodeAdded?: (node: Node) => void;
    beforeNodeMorphed?: (oldNode: Node, newNode: Node) => boolean;
    afterNodeMorphed?: (oldNode: Node, newNode: Node) => void;
    beforeNodeRemoved?: (node: Node) => boolean;
    afterNodeRemoved?: (node: Node) => void;
    beforeAttributeUpdated?: (attributeName: string, node: Element, mutationType: "update" | "remove") => boolean;
  }

  export interface IdiomorphOptions {
    morphStyle?: "outerHTML" | "innerHTML";
    ignoreActive?: boolean;
    ignoreActiveValue?: boolean;
    head?: {
      style?: "merge" | "append" | "morph" | "none";
      block?: boolean;
      ignore?: boolean;
    };
    callbacks?: IdiomorphCallbacks;
  }

  export interface IdiomorphStatic {
    morph(oldNode: Element | Document, newContent: string | Element | Document, options?: IdiomorphOptions): Element[];
  }

  export const Idiomorph: IdiomorphStatic;
}
