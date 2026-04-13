/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MessageBridge,
  type IframeMessage,
  type HostMessage,
} from "../../host/message-bridge.js";
import type { FileHandler } from "../types.js";

export class HostCommunicationService {
  private bridge: MessageBridge | null = null;
  private eventBus: EventTarget;
  private fileHandler: FileHandler | null = null;

  constructor(eventBus: EventTarget) {
    this.eventBus = eventBus;
  }

  private currentIframe: HTMLIFrameElement | null = null;

  /**
   * Install a handler for `readFile` requests from the iframe.
   *
   * Called by `loadBundleAsync` after rendering a bundle so that the
   * handler closure captures the correct ticket context.
   */
  setFileHandler(handler: FileHandler | null) {
    this.fileHandler = handler;
  }

  connect(iframe: HTMLIFrameElement) {
    // Same iframe element — keep the existing bridge (its readyPromise
    // is already resolved; rebuilding would deadlock on "ready" since
    // the iframe won't re-send it).
    if (iframe === this.currentIframe && this.bridge) return;

    if (this.bridge) {
      this.bridge.dispose();
    }
    this.currentIframe = iframe;
    this.bridge = new MessageBridge(iframe);

    this.bridge.onMessage((msg: IframeMessage) => {
      // Handle readFile requests inline — they need a response, not
      // a fire-and-forget event dispatch.
      if (msg.type === "readFile") {
        this.#handleReadFile(msg.requestId, msg.path);
        return;
      }

      // Map all other iframe events directly into the global event bus.
      this.eventBus.dispatchEvent(
        new CustomEvent(`iframe.${msg.type}`, { detail: msg })
      );
    });
  }

  async send(msg: HostMessage) {
    await this.bridge?.send(msg);
  }

  dispose() {
    this.bridge?.dispose();
    this.bridge = null;
    this.currentIframe = null;
    this.fileHandler = null;
  }

  async #handleReadFile(requestId: string, path: string) {
    if (!this.fileHandler) {
      await this.bridge?.send({
        type: "readFile.response",
        requestId,
        data: null,
        error: "No file handler installed",
      });
      return;
    }

    try {
      const data = await this.fileHandler(path);
      await this.bridge?.send({
        type: "readFile.response",
        requestId,
        data,
      });
    } catch (e) {
      await this.bridge?.send({
        type: "readFile.response",
        requestId,
        data: null,
        error: (e as Error).message,
      });
    }
  }
}

