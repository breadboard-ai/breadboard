/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
import { InitClient } from "../remote/init.js";

export const createWorker = (url: string) => {
  const workerURL = new URL(url, location.href);
  const code = `import "${workerURL}";`;
  const blob = new Blob([code], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  return new Worker(blobUrl, { type: "module" });
};

class HarnessRun {
  worker: Worker;
  initClient: InitClient;
  proxyServer: ProxyServer;
  runClient: RunClient;

  constructor(workerURL: string) {
    this.worker = createWorker(workerURL);
    const dispatcher = new PortDispatcher(this.worker);
    this.initClient = new InitClient(
      new WorkerClientTransport(dispatcher.send("load"))
    );
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
  workerURL: string;

  constructor(config: HarnessConfig) {
    this.#config = config;
    const workerURL = config.remote && config.remote.url;
    if (!workerURL) {
      throw new Error("Worker harness requires a worker URL");
    }
    this.workerURL = workerURL;
  }

  async load() {
    const url = this.#config.url;

    const runner = await Board.load(url);

    const { title, description, version } = runner;
    const diagram = runner.mermaid("TD", true);
    const nodes = runner.nodes;

    return { title, description, version, diagram, url, nodes };
  }

  async *run(state?: string) {
    const harnessRun = new HarnessRun(this.workerURL);

    await harnessRun.initClient.load(this.#config.url);

    yield* asyncGen<HarnessRunResult>(async (next) => {
      const kits = [createSecretAskingKit(next), ...this.#config.kits];
      const proxy = this.#config.proxy?.[0]?.nodes;
      harnessRun.proxyServer.serve({ kits, proxy });

      for await (const data of harnessRun.runClient.run(state)) {
        await next(data);
      }
    });
  }
}
