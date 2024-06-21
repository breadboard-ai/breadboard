/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HarnessRunResult } from "./types.js";
import { RunState, asyncGen } from "../index.js";
import { createSecretAskingKit } from "./secrets.js";
import { ProxyServer } from "../remote/proxy.js";
import {
  PortDispatcher,
  WorkerClientTransport,
  WorkerServerTransport,
} from "../remote/worker.js";
import { RunClient } from "../remote/run.js";
import { InitClient } from "../remote/init.js";
import { RunConfig } from "./run.js";

export const createWorker = (url: string) => {
  const workerURL = new URL(url, location.href);
  const code = `import "${workerURL}";`;
  const blob = new Blob([code], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  return new Worker(blobUrl, { type: "module" });
};

export async function* runInWorker(
  workerURL: string,
  config: RunConfig,
  state?: RunState
) {
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

  await initClient.load(config.url);

  yield* asyncGen<HarnessRunResult>(async (next) => {
    const kits = [createSecretAskingKit(next), ...config.kits];
    const proxyConfig = config.proxy?.[0];
    let proxy;
    if (proxyConfig && typeof proxyConfig !== "function") {
      proxy = proxyConfig.nodes;
    }
    proxyServer.serve({ kits, proxy });

    for await (const data of runClient.run(state)) {
      await next(data);
    }
  });
}
