/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues, NodeDescriptor } from "@google-labs/graph-runner";
import { MessageController } from "./controller.js";
import { Receiver } from "./receiver.js";

type TypedMessage = Record<string, unknown> & {
  type?: string;
  data?: {
    type?: string;
    node: NodeDescriptor;
    inputs: InputValues;
  };
};

export class RunResult {
  controller: MessageController;
  message: TypedMessage;

  constructor(controller: MessageController, message: TypedMessage) {
    this.controller = controller;
    this.message = message;
  }

  reply(reply: unknown) {
    if (!this.message.id) return;
    const id = this.message.id as string;
    this.controller.reply(id, reply);
  }
}

export class Runtime {
  controller: MessageController;
  receiver: Receiver;

  constructor() {
    const worker = new Worker("/src/worker.ts", { type: "module" });
    this.controller = new MessageController(worker);
    this.receiver = new Receiver();
  }

  async *run() {
    for (;;) {
      const message = (await this.controller.listen()) as TypedMessage;
      const data = message.data;
      if (data && data.type === "proxy" && message.id) {
        const id = message.id as string;
        this.controller.reply(
          id,
          await this.receiver.handle(data.node.type, data.inputs)
        );
        continue;
      }
      yield new RunResult(this.controller, message);
      if (data && data.type === "end") {
        break;
      }
    }
  }
}
