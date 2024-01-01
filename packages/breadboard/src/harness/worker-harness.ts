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
  AnyRunResult,
  Harness,
  HarnessConfig,
  HarnessRunResult,
} from "./types.js";
import { asyncGen } from "../index.js";
import { createSecretAskingKit } from "./secrets.js";
import { WorkerResult } from "./result.js";
import { ProxyServer } from "../remote/proxy.js";
import { WorkerServerTransport } from "../remote/worker.js";

export const createWorker = (url: string) => {
  const workerURL = new URL(url, location.href);
  const code = `import "${workerURL}";`;
  const blob = new Blob([code], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  return new Worker(blobUrl, { type: "module" });
};

class HarnessRun {
  worker: Worker;
  transport: WorkerTransport;
  controller: MessageController;
  proxyServer: ProxyServer;

  constructor(workerURL: string) {
    this.worker = createWorker(workerURL);
    this.transport = new WorkerTransport(this.worker);
    this.controller = new MessageController(this.transport);
    this.proxyServer = new ProxyServer(new WorkerServerTransport(this.worker));
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
    this.workerURL = workerURL;
  }

  #skipDiagnosticMessages(type: ControllerMessageType) {
    return (
      !this.#config.diagnostics &&
      (type === "nodestart" ||
        type === "nodeend" ||
        type === "graphstart" ||
        type === "graphend")
    );
  }

  async load() {
    const url = this.#config.url;

    if (this.#run) {
      this.#stop();
    }

    this.#run = new HarnessRun(this.workerURL);

    const controller = this.#run.controller;
    const result = await controller.ask<
      LoadRequestMessage,
      LoadResponseMessage
    >({ url, proxyNodes: [] }, "load");

    return result.data;
  }

  async *run() {
    if (!this.#run) {
      throw new Error("Harness hasn't been loaded. Please call 'load' first.");
    }
    const controller = this.#run.controller;

    yield* asyncGen<HarnessRunResult>(async (next) => {
      const proxy = (this.#config.proxy?.[0]?.nodes ?? []).map((node) => {
        return typeof node === "string" ? node : node.node;
      });

      const kits = [...this.#config.kits, createSecretAskingKit(next)];

      this.#run?.proxyServer.serve({ kits, proxy });

      controller.inform<StartMesssage>({}, "start");
      for (;;) {
        if (!controller) {
          break;
        }

        const message = await controller.listen();
        const { data, type } = message;
        if (this.#skipDiagnosticMessages(type)) {
          continue;
        }
        await next(new WorkerResult(controller, message as AnyRunResult));
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
