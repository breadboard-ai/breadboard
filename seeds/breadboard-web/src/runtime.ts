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

const prepareBlobUrl = (url: string) => {
  const code = `import * as worker from "${url}";`;
  const blob = new Blob([code], { type: "text/javascript" });
  return URL.createObjectURL(blob);
};

export class Runtime {
  workerURL: string;

  constructor(workerURL: string) {
    const absoluteURL = new URL(workerURL, location.href);
    this.workerURL = prepareBlobUrl(absoluteURL.href);
  }

  async *run(url: string, proxyNodes: string[]) {
    const worker = new Worker(this.workerURL, { type: "module" });
    const controller = new MessageController(worker);
    const receiver = new Receiver();
    controller.inform<StartMesssage>({ url, proxyNodes }, "start");
    for (;;) {
      const message = await controller.listen();
      const { data, type } = message;
      if (data && type === "proxy" && message.id) {
        const data = (message as ProxyRequestMessage).data;
        const id = message.id as string;
        const response = (await receiver.handle(
          data.node.type,
          data.inputs
        )) as OutputValues;
        controller.reply<ProxyResponseMessage>(id, response, "proxy");
        continue;
      }
      yield new RunResult(controller, message);
      if (data && type === "end") {
        break;
      }
    }
  }
}
