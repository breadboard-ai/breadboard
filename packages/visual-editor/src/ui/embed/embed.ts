/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardMessage,
  EmbedHandler,
  EmbedState,
} from "@breadboard-ai/types/embedder.js";
import type { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";

export * from "@breadboard-ai/types/embedder.js";

export function embedState(): EmbedState {
  return {
    showIterateOnPrompt: false,
  };
}

export class EmbedHandlerImpl extends EventTarget implements EmbedHandler {
  public debug = false;
  readonly #shellHost: OpalShellHostProtocol;

  constructor(shellHost: OpalShellHostProtocol) {
    super();
    this.#shellHost = shellHost;
  }

  #log(...msg: unknown[]) {
    if (!this.debug) {
      return;
    }
    console.log(msg);
  }

  async sendToEmbedder(message: BreadboardMessage) {
    this.#log(`[Embed handler sending]: `, message);
    this.#shellHost.sendToEmbedder(message);
  }
}
