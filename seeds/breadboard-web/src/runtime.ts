/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeDescriptor,
  OutputValues,
} from "@google-labs/graph-runner";
import {
  ControllerMessageType,
  ControllerMessageish,
  MessageController,
  ProxyResponseMessage,
  StartMesssage,
} from "./controller.js";
import { Receiver } from "./receiver.js";

const BOARD_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/math.json";

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

  reply<T extends ControllerMessageish>(reply: unknown) {
    if (!this.message.id) return;
    const id = this.message.id as string;
    const type = this.message.type as ControllerMessageType;
    this.controller.reply<T>(
      id,
      { type, ...(reply as Record<string, unknown>) },
      type
    );
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
    this.controller.inform<StartMesssage>(
      {
        url: BOARD_URL,
        proxyNodes: ["secrets", "generateText"],
      },
      "start"
    );
    for (;;) {
      const message = (await this.controller.listen()) as TypedMessage;
      const { data, type } = message;
      if (data && type === "proxy" && message.id) {
        const id = message.id as string;
        const response = (await this.receiver.handle(
          data.node.type,
          data.inputs
        )) as OutputValues;
        this.controller.reply<ProxyResponseMessage>(id, response, "proxy");
        continue;
      }
      yield new RunResult(this.controller, message);
      if (data && type === "end") {
        break;
      }
    }
  }
}
