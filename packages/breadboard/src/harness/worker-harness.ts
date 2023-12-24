/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ControllerMessageType,
  LoadRequestMessage,
  LoadResponseMessage,
  StartMesssage,
} from "../worker/protocol.js";
import { MessageController, WorkerTransport } from "../worker/controller.js";
import type {
  AnyResult,
  Harness,
  HarnessConfig,
  HarnessRunResult,
} from "./types.js";
import { asyncGen } from "../index.js";
import { ProxyReceiver } from "./receiver.js";
import { createOnSecret } from "./secrets.js";
import type { ProxyPromiseResponse } from "../remote/protocol.js";
import { WorkerRunResult } from "./result.js";

const prepareBlobUrl = (url: string) => {
  const code = `import "${url}";`;
  const blob = new Blob([code], { type: "text/javascript" });
  return URL.createObjectURL(blob);
};

class HarnessRun {
  worker: Worker;
  transport: WorkerTransport;
  controller: MessageController;

  constructor(workerURL: string) {
    this.worker = new Worker(workerURL, { type: "module" });
    this.transport = new WorkerTransport(this.worker);
    this.controller = new MessageController(this.transport);
  }

  terminate() {
    this.worker.terminate();
  }
}

export class WorkerHarness implements Harness {
  #config: HarnessConfig;
  #run: HarnessRun | null = null;
  workerURL: string;

  constructor(config: HarnessConfig) {
    this.#config = config;
    const workerURL = config.remote && config.remote.url;
    if (!workerURL) {
      throw new Error("Worker harness requires a worker URL");
    }
    const absoluteURL = new URL(workerURL, location.href);
    this.workerURL = prepareBlobUrl(absoluteURL.href);
  }

  #skipDiagnosticMessages(type: ControllerMessageType) {
    return (
      !this.#config.diagnostics &&
      (type === "beforehandler" || type === "afterhandler")
    );
  }

  async *load() {
    const url = this.#config.url;

    yield* asyncGen<HarnessRunResult>(async (next) => {
      if (this.#run) {
        this.#stop();
        await next(
          new WorkerRunResult(this.#run.controller, {
            type: "shutdown",
            data: null,
          })
        );
      }

      const proxyNodes = (this.#config.proxy?.[0]?.nodes ?? []).map((node) => {
        return typeof node === "string" ? node : node.node;
      });

      this.#run = new HarnessRun(this.workerURL);
      const controller = this.#run.controller;
      await next(
        new WorkerRunResult(
          controller,
          await controller.ask<LoadRequestMessage, LoadResponseMessage>(
            { url, proxyNodes },
            "load"
          )
        )
      );
    });
  }

  async *run() {
    if (!this.#run) {
      throw new Error("Harness hasn't been loaded. Please call 'load' first.");
    }
    const controller = this.#run.controller;

    yield* asyncGen<HarnessRunResult>(async (next) => {
      const receiver = new ProxyReceiver(this.#config, createOnSecret(next));
      controller.inform<StartMesssage>({}, "start");
      for (;;) {
        if (!controller) {
          break;
        }

        const message = await controller.listen();
        const { data, type, id } = message;
        if (type === "proxy") {
          try {
            const result = await receiver.handle(data as ProxyPromiseResponse);
            id && controller.reply(id, result.value, type);
            continue;
          } catch (e) {
            const error = e as Error;
            await next(
              new WorkerRunResult(controller, {
                type: "error",
                data: { error },
              })
            );
            break;
          }
        }
        if (this.#skipDiagnosticMessages(type)) {
          continue;
        }
        await next(new WorkerRunResult(controller, message as AnyResult));
        if (data && type === "end") {
          break;
        }
      }
    });
  }

  #stop() {
    if (!this.#run) {
      return;
    }

    this.#run.terminate();
    this.#run = null;
  }
}
