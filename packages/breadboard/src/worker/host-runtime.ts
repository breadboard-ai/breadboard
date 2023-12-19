/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ControllerMessage,
  LoadRequestMessage,
  LoadResponseMessage,
  StartMesssage,
} from "./protocol.js";
import { MessageController, WorkerTransport } from "./controller.js";

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
  const code = `import "${url}";`;
  const blob = new Blob([code], { type: "text/javascript" });
  return URL.createObjectURL(blob);
};

export class HostRuntime {
  workerURL: string;
  worker: Worker | null = null;
  transport: WorkerTransport | null = null;
  controller: MessageController | null = null;

  constructor(workerURL: string) {
    const absoluteURL = new URL(workerURL, location.href);
    this.workerURL = prepareBlobUrl(absoluteURL.href);
  }

  async *run(url: string, proxyNodes: string[]) {
    if (this.worker && this.transport && this.controller) {
      this.#stop();
      yield new RunResult(this.controller, { type: "shutdown", data: null });
    }

    this.worker = new Worker(this.workerURL, { type: "module" });
    this.transport = new WorkerTransport(this.worker);
    this.controller = new MessageController(this.transport);
    yield new RunResult(
      this.controller,
      await this.controller.ask<LoadRequestMessage, LoadResponseMessage>(
        { url, proxyNodes },
        "load"
      )
    );

    this.controller.inform<StartMesssage>({}, "start");
    for (;;) {
      if (!this.controller) {
        break;
      }

      const message = await this.controller.listen();
      const { data, type } = message;
      yield new RunResult(this.controller, message);
      if (data && type === "end") {
        break;
      }
    }
  }

  #stop() {
    if (!this.worker) {
      return;
    }

    this.worker.terminate();
    this.worker = null;
    this.transport = null;
    this.controller = null;
  }
}
