/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreadboardMessage,
  EmbedHandler,
  EmbedState,
  MessageCallback,
  MessageType,
} from "./types/types.js";

export type * from "./types/types.js";

export function embedState(): EmbedState {
  return {
    showIterateOnPrompt: false,
  };
}

export class Handler implements EmbedHandler {
  public debug = false;

  #subscribers = new Map<MessageType, unknown[]>();
  #onMessageBound = this.#onMessage.bind(this);

  #log(...msg: unknown[]) {
    if (!this.debug) {
      return;
    }

    console.log(msg);
  }

  async connect() {
    this.#log(`[Embed handler connected]`, window.top === window.self);
    self.addEventListener("message", this.#onMessageBound);
  }

  async disconnect() {
    this.#log(`[Embed handler disconnected]`);
    self.removeEventListener("message", this.#onMessageBound);
  }

  async #onMessage(evt: MessageEvent) {
    this.#log(`[Embed handler received]: `, evt.data);

    const message = evt.data as BreadboardMessage;
    const subscribers = this.#subscribers.get(message.type);
    if (!subscribers) {
      return;
    }

    for (const subscriber of subscribers) {
      const response = await (subscriber as MessageCallback).call(
        null,
        message
      );
      if (response && evt.source) {
        evt.source.postMessage(response, { targetOrigin: "*" });
      }
    }
  }

  async sendToEmbedder(message: BreadboardMessage) {
    this.#log(`[Embed handler sending]: `, message);

    if (!self.parent) {
      return;
    }
    self.parent.postMessage(message, { targetOrigin: "*" });
  }

  async subscribe<T extends MessageType>(
    type: T,
    callback: (
      message: Extract<BreadboardMessage, { type: T }>
    ) => Promise<BreadboardMessage | void>
  ): Promise<void> {
    let subscribers = this.#subscribers.get(type);
    if (!subscribers) {
      subscribers = [];
      this.#subscribers.set(type, subscribers);
    }

    if (subscribers.find((s) => s === callback)) {
      return;
    }

    subscribers.push(callback);
  }

  async unsubscribe<T extends MessageType>(
    type: T,
    callback: (
      message: Extract<BreadboardMessage, { type: T }>
    ) => Promise<BreadboardMessage | void>
  ) {
    const subscribers = this.#subscribers.get(type);
    if (!subscribers) {
      return;
    }

    const idx = subscribers.findIndex((s) => s === callback);
    if (idx === -1) {
      return;
    }

    subscribers.splice(idx, 1);
  }
}
