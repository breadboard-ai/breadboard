/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Message Bridge — typed, validated postMessage protocol.
 *
 * The host creates one bridge per iframe. The bridge:
 * - Sends typed HostMessages to the iframe
 * - Receives and validates IframeMessages from the iframe
 * - Provides an event-based API for the host to react to iframe messages
 */

import type { HostMessage, IframeMessage } from "../types.js";

export { MessageBridge };

type IframeMessageHandler = (msg: IframeMessage) => void;

class MessageBridge {
  #iframe: HTMLIFrameElement;
  #handler: IframeMessageHandler;
  #boundListener: (event: MessageEvent) => void;

  constructor(iframe: HTMLIFrameElement, handler: IframeMessageHandler) {
    this.#iframe = iframe;
    this.#handler = handler;
    this.#boundListener = this.#onMessage.bind(this);
    window.addEventListener("message", this.#boundListener);
  }

  /** Send a typed message to the iframe. */
  send(msg: HostMessage) {
    this.#iframe.contentWindow?.postMessage(msg, "*");
  }

  /** Stop listening for messages and release resources. */
  destroy() {
    window.removeEventListener("message", this.#boundListener);
  }

  #onMessage(event: MessageEvent) {
    // Only accept messages from our iframe.
    if (event.source !== this.#iframe.contentWindow) return;

    const data = event.data;
    if (!data || typeof data !== "object" || !("type" in data)) return;

    // Validate message type.
    const validTypes = ["ready", "navigate", "emit", "error"];
    if (!validTypes.includes(data.type)) {
      console.warn("[ark-bridge] Unknown message type:", data.type);
      return;
    }

    this.#handler(data as IframeMessage);
  }
}
