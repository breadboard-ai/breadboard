/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bundle frame — hosts a single sandboxed iframe for a `render: "bundle"`
 * surface item.
 *
 * Lifecycle:
 * 1. On first render, creates a blob URL iframe and immediately wires
 *    the MessageBridge (before the iframe loads, so we catch "ready").
 * 2. When the iframe signals `ready`, sends the `render` message with
 *    the bundle's JS (and optional CSS).
 * 3. Relays `sdk.call` requests to the registered handlers.
 * 4. On disconnect (or when code changes), disposes the message bridge.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { MessageBridge } from "../../../common/message-bridge.js";
import type {
  IframeMessage,
  SdkHandlers,
} from "../../../common/bundle-types.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesBundleFrame };


@customElement("bees-bundle-frame")
class BeesBundleFrame extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        position: relative;
      }

      .frame-container {
        position: relative;
        width: 100%;
        border: 1px solid #1e293b;
        border-radius: 8px;
        overflow: hidden;
        background: #0f1115;
      }

      iframe {
        display: block;
        width: 100%;
        height: 400px;
        border: none;
      }

      .error-overlay {
        padding: 12px 16px;
        background: #1a0000;
        border: 1px solid #991b1b;
        border-radius: 6px;
        color: #fca5a5;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.7rem;
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
        margin-top: 4px;
      }

      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: #64748b;
        font-size: 0.8rem;
      }
    `,
  ];

  /** The iframe HTML blob URL — created once per session, shared across instances. */
  @property({ type: String })
  accessor iframeBlobUrl: string | null = null;

  /** The CJS bundle source to render. */
  @property({ type: String })
  accessor code: string | null = null;

  /** Optional CSS to inject alongside the bundle. */
  @property({ type: String })
  accessor bundleCss: string | null = null;

  /**
   * SDK handler registry — maps method names to async handlers.
   *
   * When the iframe calls `window.opalSDK.foo(a, b)`, the host
   * looks up `sdkHandlers.get("foo")` and calls it with `[a, b]`.
   * The return value (or thrown error) is sent back to the iframe.
   */
  @property({ attribute: false })
  accessor sdkHandlers: SdkHandlers = new Map();

  @state() accessor error: string | null = null;
  @state() accessor loading = true;

  #bridge: MessageBridge | null = null;
  #wired = false;

  /** Track the code that was last sent to the iframe. */
  #renderedCode: string | null = null;
  #renderedCss: string | null = null;

  render() {
    if (!this.iframeBlobUrl || !this.code) {
      return html`<div class="loading">Preparing bundle…</div>`;
    }

    return html`
      <div class="frame-container">
        ${this.loading
          ? html`<div class="loading">Loading component…</div>`
          : nothing}
        <iframe
          sandbox="allow-scripts allow-forms"
          style=${this.loading ? "position:absolute;opacity:0;pointer-events:none" : ""}
        ></iframe>
      </div>
      ${this.error
        ? html`<div class="error-overlay">${this.error}</div>`
        : nothing}
    `;
  }

  /**
   * Wire the bridge as soon as the iframe element exists in the shadow DOM,
   * BEFORE setting its src. This ensures we catch the "ready" message.
   *
   * After the initial wire-up, detect code/CSS changes and re-send
   * the render message to the existing iframe.
   */
  protected updated(): void {
    if (!this.iframeBlobUrl || !this.code) return;

    if (!this.#wired) {
      const iframe = this.renderRoot.querySelector("iframe");
      if (!iframe) return;

      this.#wired = true;

      // Set up the bridge first — it listens for "ready" via window message.
      const bridge = new MessageBridge(iframe);
      this.#bridge = bridge;

      bridge.onMessage((msg: IframeMessage) => {
        switch (msg.type) {
          case "sdk.call":
            this.#handleSdkCall(msg.requestId, msg.method, msg.args);
            break;
          case "error":
            this.error = msg.message + (msg.stack ? "\n\n" + msg.stack : "");
            break;
        }
      });

      // NOW set the src — the bridge listener is already in place.
      iframe.src = this.iframeBlobUrl;

      // Send render once bridge is ready (iframe signals "ready").
      this.#sendRender(bridge);
      return;
    }

    // Bridge already wired — re-send render if code or CSS changed.
    if (
      this.#bridge &&
      (this.code !== this.#renderedCode || this.bundleCss !== this.#renderedCss)
    ) {
      this.#sendRender(this.#bridge);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#dispose();
  }

  async #sendRender(bridge: MessageBridge): Promise<void> {
    if (!this.code) return;

    await bridge.send({
      type: "render",
      code: this.code,
      css: this.bundleCss ?? undefined,
      props: {},
    });

    this.#renderedCode = this.code;
    this.#renderedCss = this.bundleCss;
    this.loading = false;
    this.error = null;
  }

  async #handleSdkCall(
    requestId: string,
    method: string,
    args: unknown[]
  ): Promise<void> {
    if (!this.#bridge) return;

    const handler = this.sdkHandlers.get(method);
    if (!handler) {
      await this.#bridge.send({
        type: "sdk.call.response",
        requestId,
        error: `Unknown SDK method: ${method}`,
      });
      return;
    }

    try {
      const result = await handler(...args);
      await this.#bridge.send({
        type: "sdk.call.response",
        requestId,
        result,
      });
    } catch (e) {
      await this.#bridge.send({
        type: "sdk.call.response",
        requestId,
        error: (e as Error).message,
      });
    }
  }

  /** Push an event to the sandboxed iframe via the bridge. */
  async emit(event: string, detail?: unknown): Promise<void> {
    await this.#bridge?.emit(event, detail);
  }

  #dispose(): void {
    this.#bridge?.dispose();
    this.#bridge = null;
    this.#wired = false;
    this.#renderedCode = null;
    this.#renderedCss = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-bundle-frame": BeesBundleFrame;
  }
}
