/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner } from "../runner.js";
import type { InputValues, Kit, KitConstructor } from "../types.js";
import {
  type LoadResponseMessage,
  type BeforehandlerMessage,
  type EndMessage,
  type ErrorMessage,
  type InputRequestMessage,
  type LoadRequestMessage,
  type OutputMessage,
  type StartMesssage,
  type InputResponseMessage,
} from "./protocol.js";
import { MessageController } from "./controller.js";
import { makeProxyKit } from "./proxy.js";
import { asRuntimeKit } from "../kits/ctors.js";

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
      } else if (!data.proxyNodes || !data.proxyNodes.length) {
        console.warn(
          "No nodes to proxy were specified. The board may not run correctly"
        );
      }
      this.#loadRequest = message;
      return message.data.url;
    }
    throw new Error('The only valid first message is the "load" message');
  }

  async start() {
    const message = (await this.#controller.listen()) as StartMesssage;
    if (message.type !== "start") {
      throw new Error(
        'The only valid message at this point is the "start" message'
      );
    }
  }

  async run(board: BoardRunner, kitConstructors: KitConstructor<Kit>[]) {
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
          diagram: board.mermaid(),
          url: this.#loadRequest.data.url,
        },
        "load"
      );

      await this.start();

      const proxyKit = makeProxyKit(
        this.#loadRequest.data.proxyNodes,
        this.#controller
      );

      const kits = [proxyKit, ...kitConstructors].map((kitConstructor) =>
        asRuntimeKit(kitConstructor)
      );

      for await (const stop of board.run({ kits })) {
        if (stop.type === "input") {
          const inputMessage = (await this.#controller.ask<
            InputRequestMessage,
            InputResponseMessage
          >(
            {
              node: stop.node,
              inputArguments: stop.inputArguments,
            },
            stop.type
          )) as { data: InputValues };
          stop.inputs = inputMessage.data;
        } else if (stop.type === "output") {
          this.#controller.inform<OutputMessage>(
            {
              node: stop.node,
              outputs: stop.outputs,
            },
            stop.type
          );
        } else if (stop.type === "beforehandler") {
          this.#controller.inform<BeforehandlerMessage>(
            {
              node: stop.node,
            },
            stop.type
          );
        }
      }
      this.#controller.inform<EndMessage>({}, "end");
    } catch (e) {
      const error = e as Error;
      console.error(error);
      this.#controller.inform<ErrorMessage>({ error: error.message }, "error");
    }
  }
}
