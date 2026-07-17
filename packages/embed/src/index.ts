import { RealtalkEmbedElement } from "./embed-element.js";

if (typeof window !== "undefined" && !customElements.get("realtalk-embed")) {
  customElements.define("realtalk-embed", RealtalkEmbedElement);
}

export { RealtalkEmbedElement };
