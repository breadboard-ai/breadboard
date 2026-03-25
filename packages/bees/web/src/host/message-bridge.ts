/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MessageBridge — typed postMessage communication between host and iframe.
 *
 * The host creates a MessageBridge for each iframe element. The bridge
 * validates incoming messages and provides a typed send() method.
 */

export { MessageBridge };
export type { HostMessage, IframeMessage };

/** Messages from host → iframe. */
type HostMessage =
  | {
      type: "render";
      code: string;
      props?: Record<string, unknown>;
      assets?: Record<string, string>;
    }
  | { type: "update-props"; props: Record<string, unknown> };

/** Messages from iframe → host. */
type IframeMessage =
  | { type: "ready" }
  | { type: "navigate"; viewId: string; params?: Record<string, unknown> }
  | { type: "emit"; event: string; payload?: unknown }
  | { type: "error"; message: string; stack?: string };

const VALID_IFRAME_TYPES = new Set(["ready", "navigate", "emit", "error"]);

class MessageBridge {
  readonly #iframe: HTMLIFrameElement;
  readonly #handler: (msg: IframeMessage) => void;
  readonly #listener: (event: MessageEvent) => void;

  constructor(
    iframe: HTMLIFrameElement,
    handler: (msg: IframeMessage) => void
  ) {
    this.#iframe = iframe;
    this.#handler = handler;

    this.#listener = (event: MessageEvent) => {
      // Only accept messages from our iframe.
      if (event.source !== iframe.contentWindow) return;

      const data = event.data;
      if (!data || typeof data.type !== "string") return;
      if (!VALID_IFRAME_TYPES.has(data.type)) return;

      this.#handler(data as IframeMessage);
    };

    window.addEventListener("message", this.#listener);
  }

  /** Send a typed message to the iframe. */
  send(msg: HostMessage): void {
    this.#iframe.contentWindow?.postMessage(msg, "*");
  }

  /** Remove the message listener. */
  destroy(): void {
    window.removeEventListener("message", this.#listener);
  }
}
