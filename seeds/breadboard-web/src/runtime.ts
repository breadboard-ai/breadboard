/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputValues } from "@google-labs/graph-runner";
import type {
  ControllerMessage,
  ProxyResponseMessage,
  StartMesssage,
  ProxyRequestMessage,
} from "./protocol.js";
import { MessageController } from "./controller.js";
import { Receiver } from "./receiver.js";

export class RunResult {
  controller: MessageController;
  message: ControllerMessage;

  constructor(controller: MessageController, message: ControllerMessage) {
    this.controller = controller;
    this.message = message;
  }

  reply<T extends ControllerMessage>(reply: unknown) {
    if (!this.message.id) return;
    const { id, type } = this.message;
    this.controller.reply<T>(id, reply as Record<string, unknown>, type);
  }
}

export class Runtime {
  url: string;
  controller: MessageController;
  receiver: Receiver;

  constructor(url: string, workerURL: string) {
    this.url = url;
    const worker = new Worker(workerURL, { type: "module" });
    this.controller = new MessageController(worker);
    this.receiver = new Receiver();
  }

  async *run() {
    this.controller.inform<StartMesssage>(
      {
        url: this.url,
        proxyNodes: ["secrets", "generateText"],
      },
      "start"
    );
    for (;;) {
      const message = await this.controller.listen();
      const { data, type } = message;
      if (data && type === "proxy" && message.id) {
        const data = (message as ProxyRequestMessage).data;
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
