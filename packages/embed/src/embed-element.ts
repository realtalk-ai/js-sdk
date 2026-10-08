import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EmbedApp } from "./EmbedApp.js";
import { DEFAULT_SERVER_URL } from "./session.js";
import { styles } from "./styles.js";
import {
  isHexColor,
  isRounding,
  resolveTheme,
  type ThemeOptions,
} from "./theme.js";

// Lets server-side code import the package, where HTMLElement does not exist.
const BaseElement =
  typeof HTMLElement !== "undefined"
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);

export class RealtalkEmbedElement extends BaseElement {
  static observedAttributes = ["accent-color", "rounding"];

  private root: Root | null = null;
  private mountPoint: HTMLElement | null = null;

  connectedCallback() {
    const agentId = this.getAttribute("agent-id");
    if (!agentId) {
      console.error("[realtalk-embed] the agent-id attribute is required.");
      return;
    }
    const serverUrl = this.getAttribute("server-url") ?? DEFAULT_SERVER_URL;
    // Temporary switch for testing voice until the agent config says whether voice is enabled.
    const voiceEnabled = this.hasAttribute("enable-voice");

    if (!this.mountPoint) {
      const shadowRoot = this.attachShadow({ mode: "open" });

      const styleElement = document.createElement("style");
      styleElement.textContent = styles;
      shadowRoot.appendChild(styleElement);

      this.mountPoint = document.createElement("div");
      this.mountPoint.className = "theme";
      shadowRoot.appendChild(this.mountPoint);
    }

    this.applyTheme();
    this.root = createRoot(this.mountPoint);
    this.root.render(
      createElement(EmbedApp, { agentId, serverUrl, voiceEnabled }),
    );
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }

  attributeChangedCallback() {
    this.applyTheme();
  }

  // Runs before connectedCallback for attributes present in the markup, so
  // it has to wait for the mount point.
  private applyTheme() {
    if (!this.mountPoint) {
      return;
    }

    this.mountPoint.removeAttribute("style");
    const tokens = resolveTheme(this.themeOptionsFromAttributes());
    for (const [name, value] of Object.entries(tokens)) {
      this.mountPoint.style.setProperty(name, value);
    }
  }

  private themeOptionsFromAttributes(): ThemeOptions {
    const options: ThemeOptions = {};

    const accent = this.getAttribute("accent-color");
    if (accent !== null) {
      if (isHexColor(accent)) {
        options.accent = accent;
      } else {
        console.warn(
          "[realtalk-embed] accent-color must be a hex color like #1d4ed8.",
        );
      }
    }

    const rounding = this.getAttribute("rounding");
    if (rounding !== null) {
      if (isRounding(rounding)) {
        options.rounding = rounding;
      } else {
        console.warn(
          "[realtalk-embed] rounding must be small, medium or large.",
        );
      }
    }

    return options;
  }
}
