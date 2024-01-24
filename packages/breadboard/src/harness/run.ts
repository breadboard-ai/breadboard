/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Kit, asyncGen } from "../index.js";
import { NodeProxyConfig } from "../remote/config.js";
import { HTTPClientTransport } from "../remote/http.js";
import { ProxyClient } from "../remote/proxy.js";
import { runLocally } from "./local.js";
import { createSecretAskingKit } from "./secrets.js";
import { HarnessRunResult } from "./types.js";
import { runInWorker } from "./worker.js";

export type ProxyLocation = "main" | "worker" | "http";

export type HarnessProxyConfig = {
  location: ProxyLocation;
  url?: string;
  nodes: NodeProxyConfig;
};

export type HarnessRemoteConfig =
  | {
      /**
       * The type of the remote runtime. Can be "http" or "worker".
       * Currently, only "worker" is supported.
       */
      type: "http" | "worker";
      /**
       * The URL of the remote runtime. Specifies the URL of the worker
       * script if `type` is "worker", or the URL of the runtime server if
       * `type` is "http".
       */
      url: string;
    }
  | false;

export type RunConfig = {
  /**
   * The URL of the board to run.
   */
  url: string;
  /**
   * The base URL relative to which to load the board.
   * If ran in a browser, defaults to the current URL.
   * Otherwise, defaults to invoking module's URL.
   */
  base?: URL;
  /**
   * The kits to use by the runtime.
   */
  kits: Kit[];
  /**
   * Specifies the remote environment in which to run the harness.
   * In this situation, the harness creates a runtime client, and relies
   * on the remote environment to act as the runtime server
   * If `remote` is not specified or is "false", this harness runs the board
   * itself, acting as a server (there is no need for a client).
   */
  remote?: HarnessRemoteConfig;
  /**
   * Specifies a list of node proxies to use. Each item specifies a proxy
   * server and a list of nodes that will be proxied to it.
   */
  proxy?: HarnessProxyConfig[];
  /**
   * Specifies whether to output diagnostics information.
   * Defaults to `false`.
   */
  diagnostics?: boolean;
};

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
