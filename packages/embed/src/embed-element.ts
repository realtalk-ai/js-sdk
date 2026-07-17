import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EmbedApp } from "./EmbedApp.js";
import { DEFAULT_SERVER_URL } from "./session.js";
import { styles } from "./styles.js";

// Lets server-side code import the package, where HTMLElement does not exist.
const BaseElement =
  typeof HTMLElement !== "undefined"
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);

export class RealtalkEmbedElement extends BaseElement {
  private root: Root | null = null;
  private mountPoint: HTMLElement | null = null;

  connectedCallback() {
    const agentId = this.getAttribute("agent-id");
    if (!agentId) {
      console.error("[realtalk-embed] the agent-id attribute is required.");
      return;
    }
    const serverUrl = this.getAttribute("server-url") ?? DEFAULT_SERVER_URL;

    if (!this.mountPoint) {
      const shadowRoot = this.attachShadow({ mode: "open" });

      const styleElement = document.createElement("style");
      styleElement.textContent = styles;
      shadowRoot.appendChild(styleElement);

      this.mountPoint = document.createElement("div");
      shadowRoot.appendChild(this.mountPoint);
    }

    this.root = createRoot(this.mountPoint);
    this.root.render(createElement(EmbedApp, { agentId, serverUrl }));
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }
}
