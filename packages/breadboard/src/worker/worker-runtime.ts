/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ErrorMessage, type LoadRequestMessage } from "./protocol.js";
import { MessageController } from "./controller.js";

export class WorkerRuntime {
  #controller: MessageController;

  constructor(controller: MessageController) {
    this.#controller = controller;
    self.onerror = (e) => {
      this.#controller.inform<ErrorMessage>(
        { error: `Unhandled error in worker: ${e}` },
        "error"
      );
    };
  }

  async onload(): Promise<string> {
    const message = (await this.#controller.listen()) as LoadRequestMessage;
    if (message.type === "load") {
      const data = message.data;
      if (!data.url) {
        throw new Error("The load message must include a url");
      }
      return message.data.url;
    }
    throw new Error('The only valid first message is the "load" message');
  }
}
