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

export class HostCommunicationService {
  private bridge: MessageBridge | null = null;
  private eventBus: EventTarget;

  constructor(eventBus: EventTarget) {
    this.eventBus = eventBus;
  }

  private currentIframe: HTMLIFrameElement | null = null;

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
      // Map all iframe events directly into the global event bus.
      // E.g 'render_complete' -> 'iframe.render_complete'
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
  }
}
