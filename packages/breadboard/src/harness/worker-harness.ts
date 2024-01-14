/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Harness, HarnessConfig, HarnessRunResult } from "./types.js";
import { asyncGen } from "../index.js";
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

export class WorkerHarness implements Harness {
  #config: HarnessConfig;

  constructor(config: HarnessConfig) {
    this.#config = config;
  }

  async *run(state?: string) {
    const workerURL = this.#config.remote && this.#config.remote.url;
    if (!workerURL) {
      throw new Error("Worker harness requires a worker URL");
    }

    const worker = createWorker(workerURL);
    const dispatcher = new PortDispatcher(worker);
    const initClient = new InitClient(
      new WorkerClientTransport(dispatcher.send("load"))
    );
    const proxyServer = new ProxyServer(
      new WorkerServerTransport(dispatcher.receive("proxy"))
    );
    const runClient = new RunClient(
      new WorkerClientTransport(dispatcher.send("run"))
    );

    await initClient.load(this.#config.url);

    yield* asyncGen<HarnessRunResult>(async (next) => {
      const kits = [createSecretAskingKit(next), ...this.#config.kits];
      const proxy = this.#config.proxy?.[0]?.nodes;
      proxyServer.serve({ kits, proxy });

      for await (const data of runClient.run(state)) {
        await next(data);
      }
    });
  }
}
