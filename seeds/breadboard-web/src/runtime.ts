/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageController } from "./controller.js";

type TypedMessage = Record<string, unknown> & {
  type?: string;
  data?: {
    type?: string;
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
    if (this.message.id) {
      const id = this.message.id as string;
      this.controller.reply(id, reply);
    }
  }
}

export class Runtime {
  controller: MessageController;

  constructor() {
    const worker = new Worker("/src/worker.ts", { type: "module" });
    this.controller = new MessageController(worker);
  }

  async *run() {
    for (;;) {
      const message = (await this.controller.listen()) as TypedMessage;
      if (message.type === "secret") {
        const data = window.localStorage.getItem("PALM_KEY");
        this.controller.worker.postMessage({ type: "secret", data });
        continue;
      } else if (message.data && message.data.type === "end") {
        break;
      }
      yield new RunResult(this.controller, message);
    }
  }
}
