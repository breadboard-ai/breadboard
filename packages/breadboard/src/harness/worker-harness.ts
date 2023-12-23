/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  LoadRequestMessage,
  LoadResponseMessage,
  ProxyResponseMessage,
  StartMesssage,
} from "../worker/protocol.js";
import { MessageController, WorkerTransport } from "../worker/controller.js";
import type { Harness, HarnessConfig, HarnessRunResult } from "./types.js";
import { OutputValues, asyncGen } from "../index.js";
import { ProxyReceiver } from "./receiver.js";
import { createOnSecret } from "./secrets.js";
import type { ProxyPromiseResponse } from "../remote/protocol.js";
import { WorkerRunResult } from "./result.js";

const prepareBlobUrl = (url: string) => {
  const code = `import "${url}";`;
  const blob = new Blob([code], { type: "text/javascript" });
  return URL.createObjectURL(blob);
};

export class WorkerHarness implements Harness {
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
    yield* asyncGen<HarnessRunResult>(async (next) => {
      if (this.worker && this.transport && this.controller) {
        this.#stop();
        await next(
          new WorkerRunResult(this.controller, { type: "shutdown", data: null })
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
        new WorkerRunResult(
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
        const { data, type, id } = message;
        if (type === "proxy") {
          try {
            const result = (await receiver.handle(
              data as ProxyPromiseResponse
            )) as OutputValues;
            id && this.controller.reply<ProxyResponseMessage>(id, result, type);
            continue;
          } catch (e) {
            const err = e as Error;
            await next(
              new WorkerRunResult(this.controller, {
                type: "error",
                data: err.message,
              })
            );
            break;
          }
        }
        await next(new WorkerRunResult(this.controller, message));
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
