/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asyncGen } from "../index.js";
import { HTTPClientTransport } from "../remote/http.js";
import { ProxyClient } from "../remote/proxy.js";
import { runLocally } from "./local.js";
import { createSecretAskingKit } from "./secrets.js";
import { RunConfig, HarnessRunResult } from "./types.js";
import { runInWorker } from "./worker.js";

const configureKits = (config: RunConfig) => {
  // If a proxy is configured, add the proxy kit to the list of kits.
  const proxyConfig = config.proxy?.[0];
  if (!proxyConfig) return config.kits;

  if (proxyConfig.location !== "http") {
    throw new Error("Only HTTP node proxy server is supported at this time.");
  }

  if (!proxyConfig.url) {
    throw new Error("No node proxy server URL provided.");
  }

  const proxyClient = new ProxyClient(new HTTPClientTransport(proxyConfig.url));
  return [proxyClient.createProxyKit(proxyConfig.nodes), ...config.kits];
};

export async function* run(config: RunConfig) {
  if (!config.remote) {
    yield* asyncGen<HarnessRunResult>(async (next) => {
      const kits = [createSecretAskingKit(next), ...configureKits(config)];

      for await (const data of runLocally(config, kits)) {
        await next(data);
      }
    });
  } else if (config.remote.type === "worker") {
    const workerURL = config.remote && config.remote.url;
    if (!workerURL) {
      throw new Error("Worker harness requires a worker URL");
    }
    yield* runInWorker(workerURL, config);
  } else {
    throw new Error(
      `Unsupported harness configuration: ${JSON.stringify(config, null, 2)}`
    );
  }
}
