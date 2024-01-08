/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner } from "../runner.js";
import {
  type LoadResponseMessage,
  type ErrorMessage,
  type LoadRequestMessage,
} from "./protocol.js";
import { MessageController } from "./controller.js";

export class WorkerRuntime {
  #controller: MessageController;
  #loadRequest: LoadRequestMessage | undefined;

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
      this.#loadRequest = message;
      return message.data.url;
    }
    throw new Error('The only valid first message is the "load" message');
  }

  async sendBoardInfo(board: BoardRunner) {
    if (!this.#loadRequest) {
      throw new Error("The load message must be sent before the run message");
    }

    this.#controller.reply<LoadResponseMessage>(
      this.#loadRequest.id,
      {
        title: board.title,
        description: board.description,
        version: board.version,
        diagram: board.mermaid("TD", true),
        url: this.#loadRequest.data.url,
        nodes: board.nodes,
      },
      "load"
    );
  }
}
