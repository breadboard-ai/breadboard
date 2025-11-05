/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardMessage,
  EmbedderMessage,
  EmbedHandler,
  EmbedState,
} from "@breadboard-ai/types/embedder.js";
import type { OpalShellProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";

export * from "@breadboard-ai/types/embedder.js";

export function embedState(): EmbedState {
  return {
    showIterateOnPrompt: false,
  };
}

export class EmbedHandlerImpl extends EventTarget implements EmbedHandler {
  public debug = false;
  readonly #onMessageBound = this.#onMessage.bind(this);
  readonly #shellHost: OpalShellProtocol;

  constructor(shellHost: OpalShellProtocol) {
    super();
    this.#shellHost = shellHost;
  }

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

  async #onMessage(evt: MessageEvent) {
    this.#log(`[Embed handler received]: `, evt.data);
    this.dispatchEvent(
      new EmbedderMessageEventImpl(evt.data as EmbedderMessage)
    );
  }

  async sendToEmbedder(message: BreadboardMessage) {
    this.#log(`[Embed handler sending]: `, message);
    this.#shellHost.sendToEmbedder(message);
  }
}

class EmbedderMessageEventImpl<T extends EmbedderMessage> extends Event {
  readonly message: T;
  constructor(message: T) {
    super(message.type);
    this.message = message;
  }
}
