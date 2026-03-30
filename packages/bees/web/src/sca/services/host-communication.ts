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

  connect(iframe: HTMLIFrameElement) {
    if (this.bridge) {
      this.bridge.dispose();
    }
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
  }
}
