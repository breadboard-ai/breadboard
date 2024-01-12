/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LoadRequestMessage } from "../worker/protocol.js";
import { MessageController, WorkerTransport } from "../worker/controller.js";
import type { Harness, HarnessConfig, HarnessRunResult } from "./types.js";
import { Board, asyncGen } from "../index.js";
import { createSecretAskingKit } from "./secrets.js";
import { ProxyServer } from "../remote/proxy.js";
import {
  PortDispatcher,
  WorkerClientTransport,
  WorkerServerTransport,
} from "../remote/worker.js";
import { RunClient } from "../remote/run.js";
import { AnyRunResponseMessage } from "../remote/protocol.js";

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
  runClient: RunClient;

  constructor(workerURL: string) {
    this.worker = createWorker(workerURL);
    const dispatcher = new PortDispatcher(this.worker);
    this.transport = new WorkerTransport(this.worker);
    this.controller = new MessageController(this.transport);
    this.proxyServer = new ProxyServer(
      new WorkerServerTransport(dispatcher.receive("proxy"))
    );
    this.runClient = new RunClient(
      new WorkerClientTransport(dispatcher.send("run"))
    );
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

  #skipDiagnosticMessages(type: AnyRunResponseMessage[0]) {
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

    const runner = await Board.load(url);

    const { title, description, version } = runner;
    const diagram = runner.mermaid("TD", true);
    const nodes = runner.nodes;

    this.#run = new HarnessRun(this.workerURL);

    const controller = this.#run.controller;
    controller.inform<LoadRequestMessage>({ url }, "load");

    return { title, description, version, diagram, url, nodes };
  }

  async *run(state?: string) {
    if (!this.#run) {
      throw new Error("Harness hasn't been loaded. Please call 'load' first.");
    }

    yield* asyncGen<HarnessRunResult>(async (next) => {
      const kits = [createSecretAskingKit(next), ...this.#config.kits];
      const proxy = this.#config.proxy?.[0]?.nodes;
      if (!this.#run) {
        // This is only necessary because TypeScript doesn't know that
        // `this.#run` is non-null after the `if` statement above.
        return;
      }

      this.#run.proxyServer.serve({ kits, proxy });

      for await (const data of this.#run.runClient.run(state)) {
        const { type } = data;
        if (this.#skipDiagnosticMessages(type)) {
          continue;
        }
        await next(data);
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
