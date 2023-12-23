/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ControllerMessage,
  LoadRequestMessage,
  LoadResponseMessage,
  ProxyResponseMessage,
  StartMesssage,
} from "./protocol.js";
import { MessageController, WorkerTransport } from "./controller.js";
import { HarnessConfig } from "../harness/types.js";
import { OutputValues, asyncGen } from "../index.js";
import { ProxyReceiver } from "../harness/receiver.js";
import { createOnSecret } from "../harness/secrets.js";
import { ProxyPromiseResponse } from "../remote/protocol.js";

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
  #config: HarnessConfig;
  workerURL: string;
  worker: Worker | null = null;
  transport: WorkerTransport | null = null;
  controller: MessageController | null = null;

  constructor(config: HarnessConfig) {
    this.#config = config;
    const workerURL = config.remote && config.remote.url;
    if (!workerURL) {
      throw new Error("Worker harness requires a worker URL");
    }
    const absoluteURL = new URL(workerURL, location.href);
    this.workerURL = prepareBlobUrl(absoluteURL.href);
  }

  async *run(url: string) {
    yield* asyncGen<RunResult>(async (next) => {
      if (this.worker && this.transport && this.controller) {
        this.#stop();
        await next(
          new RunResult(this.controller, { type: "shutdown", data: null })
        );
      }

      const receiver = new ProxyReceiver(this.#config, createOnSecret(next));
      const proxyNodes = (this.#config.proxy?.[0]?.nodes ?? []).map((node) => {
        return typeof node === "string" ? node : node.node;
      });

      this.worker = new Worker(this.workerURL, { type: "module" });
      this.transport = new WorkerTransport(this.worker);
      this.controller = new MessageController(this.transport);
      await next(
        new RunResult(
          this.controller,
          await this.controller.ask<LoadRequestMessage, LoadResponseMessage>(
            { url, proxyNodes },
            "load"
          )
        )
      );

      this.controller.inform<StartMesssage>({}, "start");
      for (;;) {
        if (!this.controller) {
          break;
        }

        const message = await this.controller.listen();
        const { data, type } = message;
        if (type === "proxy") {
          try {
            const handledResult = await receiver.handle(
              data as ProxyPromiseResponse
            );
            message.id &&
              this.controller.reply<ProxyResponseMessage>(
                message.id,
                handledResult as OutputValues,
                type
              );
            continue;
          } catch (e) {
            const err = e as Error;
            await next(
              new RunResult(this.controller, {
                type: "error",
                data: err.message,
              })
            );
            break;
          }
        }
        await next(new RunResult(this.controller, message));
        if (data && type === "end") {
          break;
        }
      }
    });
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
