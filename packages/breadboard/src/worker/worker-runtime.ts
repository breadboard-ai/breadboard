/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner } from "../runner.js";
import type { Kit } from "../types.js";
import {
  type LoadResponseMessage,
  type ErrorMessage,
  type LoadRequestMessage,
} from "./protocol.js";
import { MessageController } from "./controller.js";
import { PortDispatcher, WorkerServerTransport } from "../remote/worker.js";
import { RunServer } from "../remote/run.js";

export class WorkerRuntime {
  #controller: MessageController;
  #dispatcher: PortDispatcher;
  #loadRequest: LoadRequestMessage | undefined;

  constructor(controller: MessageController, dispatcher: PortDispatcher) {
    this.#controller = controller;
    this.#dispatcher = dispatcher;
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

  async run(board: BoardRunner, kits: Kit[]) {
    try {
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

      const server = new RunServer(
        new WorkerServerTransport(this.#dispatcher.receive("run"))
      );
      await server.serve(board, true, { kits });
    } catch (e) {
      let error = e as Error;
      let message = "";
      while (error?.cause) {
        error = (error.cause as { error: Error }).error;
        message += `\n${error.message}`;
      }
      console.error("Error in worker:", error.message);
      this.#controller.inform<ErrorMessage>({ error: message }, "error");
    }
  }
}
