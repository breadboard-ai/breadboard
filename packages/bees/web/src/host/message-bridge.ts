/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Host-side typed postMessage bridge for communicating with the
 * sandboxed iframe.
 *
 * Usage:
 *   const bridge = new MessageBridge(iframeEl);
 *   bridge.onMessage((msg) => { ... });
 *   bridge.send({ type: "render", code, props, assets });
 *   bridge.dispose();
 */

import type { HostMessage, IframeMessage } from "../iframe/entry.js";

export { HostMessage, IframeMessage };

export class MessageBridge {
  #iframe: HTMLIFrameElement;
  #handler: ((event: MessageEvent) => void) | null = null;
  #ready = false;
  #readyPromise: Promise<void>;
  #resolveReady!: () => void;

  constructor(iframe: HTMLIFrameElement) {
    this.#iframe = iframe;
    this.#readyPromise = new Promise((resolve) => {
      this.#resolveReady = resolve;

      // If the iframe is already fully loaded, we likely missed the 'ready' message.
      // Because it's on the same origin, we can check readyState safely.
      try {
        if (iframe.contentDocument?.readyState === "complete") {
          this.#ready = true;
          resolve();
        }
      } catch {
        // Cross-origin fallback, though this spike is same-origin.
      }
    });
  }

  /** Send a message to the iframe. Waits for the iframe to signal ready. */
  async send(msg: HostMessage): Promise<void> {
    await this.#readyPromise;
    this.#iframe.contentWindow?.postMessage(msg, "*");
  }

  /**
   * Listen for messages from the iframe.
   *
   * The callback receives typed IframeMessages. The "ready" message is
   * handled internally and not forwarded.
   */
  onMessage(callback: (msg: IframeMessage) => void): void {
    this.#handler = (event: MessageEvent) => {
      // Only accept messages from our iframe.
      if (event.source !== this.#iframe.contentWindow) return;

      const data = event.data as IframeMessage;
      if (!data || typeof data !== "object" || !("type" in data)) return;

      if (data.type === "ready") {
        this.#ready = true;
        this.#resolveReady();
        return;
      }

      callback(data);
    };

    window.addEventListener("message", this.#handler);
  }

  /** Whether the iframe has signalled readiness. */
  get ready(): boolean {
    return this.#ready;
  }

  /** Clean up the message listener. */
  dispose(): void {
    if (this.#handler) {
      window.removeEventListener("message", this.#handler);
      this.#handler = null;
    }
  }
}
