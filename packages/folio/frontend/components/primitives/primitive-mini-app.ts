/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { sharedStyles } from "../../ui/shared-styles.js";
import { icons } from "../../ui/icons.js";

interface MiniAppFrame extends Window {
  opalSDK: {
    emit: (event: string, data: unknown) => void;
    navigateTo: (view: string, data: unknown) => void;
    readFile: (path: string) => Promise<string | null>;
  };
}

@customElement("o-primitive-mini-app")
export class PrimitiveMiniApp extends SignalWatcher(LitElement) {
  @property({ type: String })
  accessor src = "";

  @property({ type: Object })
  accessor tokenOverrides: Record<string, string> = {};

  @property({ type: Boolean, reflect: true })
  accessor borderless = false;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    iframe {
      border: 1px solid var(--opal-color-border-subtle);
      background: var(--o-mini-app-bg, var(--opal-color-surface-tinted));
      width: calc(100% - 2px);
      height: var(--mini-app-height, 300px);
      display: block;
      border-radius: var(--opal-radius-8);
    }

    :host([borderless]) {
      mask: linear-gradient(
        to right,
        #ff00ff,
        #ff00ff calc(100% - var(--opal-grid-10, 40px)),
        #ff00ff00 100%
      );
    }

    :host([borderless]) iframe {
      border: none;
      background: transparent;
      width: 100%;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.#onMessage);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("message", this.#onMessage);
  }

  willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);
    if (changedProperties.has("src")) {
      this.style.removeProperty("--mini-app-height");
      this.#hasMeasured = false;
    }
  }

  #hasMeasured = false;

  #onMessage = (e: MessageEvent) => {
    const data = e.data;
    if (data && data.type === "resize" && typeof data.height === "number") {
      this.style.setProperty("--mini-app-height", `${data.height}px`);

      if (!this.#hasMeasured) {
        this.#hasMeasured = true;
        this.dispatchEvent(
          new Event("mini-app-ready", { bubbles: true, composed: true })
        );
      }
    }
  };

  #onIframeLoad(e: Event) {
    const iframe = e.target as HTMLIFrameElement;
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;

    if (!doc || !win) return;

    console.log("[MiniApp] Iframe loaded, injecting SDK and styles.");

    // Inject Faux SDK
    (win as unknown as MiniAppFrame).opalSDK = {
      emit: (event: string, data: unknown) => {
        console.log(`[MiniApp] Emit: ${event}`, data);
        this.dispatchEvent(
          new CustomEvent("emit", {
            detail: { event, data },
            bubbles: true,
            composed: true,
          })
        );
      },
      navigateTo: (view: string, data: unknown) => {
        console.log(`[MiniApp] NavigateTo: ${view}`, data);
        this.dispatchEvent(
          new CustomEvent("navigate", {
            detail: { view, data },
            bubbles: true,
            composed: true,
          })
        );
      },
      readFile: async (path: string) => {
        console.log(`[MiniApp] ReadFile: ${path}`);
        return null;
      },
    };

    // Lift links from host page (fonts, tokens, palette, etc.)
    const hostLinks = document.querySelectorAll('link[rel="stylesheet"]');
    hostLinks.forEach((link) => {
      const clonedLink = doc.createElement("link");
      clonedLink.rel = "stylesheet";
      clonedLink.href = (link as HTMLLinkElement).href;
      doc.head.appendChild(clonedLink);
    });

    // Inject Resize Script
    const script = doc.createElement("script");
    script.textContent = `
      const observer = new ResizeObserver(() => {
        window.parent.postMessage({
          type: 'resize',
          height: document.body.scrollHeight
        }, '*');
      });
      observer.observe(document.body);
    `;
    doc.body.appendChild(script);

    // Inject Shared Styles
    const styleShared = doc.createElement("style");
    styleShared.textContent = sharedStyles.cssText;
    doc.head.appendChild(styleShared);

    // Inject Icon Styles
    const styleIcons = doc.createElement("style");
    styleIcons.textContent = icons.cssText;
    doc.head.appendChild(styleIcons);

    // 2. Inject custom style block for host overrides
    const style = doc.createElement("style");
    let styleContent = `:root {`;
    if (this.tokenOverrides) {
      for (const [key, value] of Object.entries(this.tokenOverrides)) {
        styleContent += `${key}: ${value};`;
      }
    }
    styleContent += `}`;
    style.textContent = styleContent;
    doc.head.appendChild(style);
  }

  render() {
    return html`
      <iframe src="${this.src}" @load=${this.#onIframeLoad}></iframe>
    `;
  }
}
