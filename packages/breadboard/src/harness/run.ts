/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreadboardRunner,
  DataStore,
  InputValues,
  Kit,
  asyncGen,
} from "../index.js";
import { NodeProxyConfig } from "../remote/config.js";
import { HTTPClientTransport } from "../remote/http.js";
import { ProxyClient, SimplePythonProxyClient } from "../remote/proxy.js";
import { runLocally } from "./local.js";
import { createSecretAskingKit } from "./secrets.js";
import { HarnessRunResult } from "./types.js";
import { runInWorker } from "./worker.js";
import { GraphLoader } from "../loader/types.js";

export type ProxyLocation = "main" | "worker" | "http" | "python";

export type CustomProxyConfig = () => Promise<Kit>;

export type HarnessProxyConfig =
  | {
      location: ProxyLocation;
      url?: string;
      nodes: NodeProxyConfig;
    }
  | CustomProxyConfig;

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
   * The loader to use when loading boards.
   */
  loader?: GraphLoader;
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
  /**
   * Specifies a runner to use. This can be used instead of loading a board
   * from a URL.
   */
  runner?: BreadboardRunner;
  /**
   * The `AbortSignal` that can be used to stop the board run.
   */
  signal?: AbortSignal;
  /**
   * The values that will be supplied to the bubbled inputs during a board run.
   * This enables automatically providing some of the values like the model
   * name without interrupting the run of the board.
   */
  inputs?: InputValues;
  /**
   * Specifies whether or not secrets are asked for interactively. When `true`,
   * the `secret` result will start showing up in the run results whenever
   * the secret is asked for. Otherwise, the `secrets` node will try to find
   * the secrets on its own.
   */
  interactiveSecrets?: boolean;
  /**
   * The data store to use for storing data.
   */
  store?: DataStore;
};

const configureKits = async (config: RunConfig): Promise<Kit[]> => {
  // If a proxy is configured, add the proxy kit to the list of kits.
  if (!config.proxy) return config.kits;
  const kits: Kit[] = [];
  for (const proxyConfig of config.proxy) {
    if (typeof proxyConfig === "function") {
      const config = await proxyConfig();
      if (!config) continue;
      kits.push(await proxyConfig());
    } else {
      switch (proxyConfig.location) {
        case "http": {
          if (!proxyConfig.url) {
            throw new Error("No node proxy server URL provided.");
          }
          const proxyClient = new ProxyClient(
            new HTTPClientTransport(proxyConfig.url)
          );
          kits.push(proxyClient.createProxyKit(proxyConfig.nodes));
          break;
        }
        case "python": {
          if (!proxyConfig.url) {
            throw new Error("No node proxy server URL provided.");
          }
          const proxyClient = new SimplePythonProxyClient(proxyConfig.url);
          kits.push(proxyClient.createProxyKit(proxyConfig.nodes));
          break;
        }
        default: {
          throw new Error(
            "Only HTTP node proxy server is supported at this time."
          );
        }
      }
    }
  }
  return [...kits, ...config.kits];
};

export async function* run(config: RunConfig) {
  if (!config.remote) {
    yield* asyncGen<HarnessRunResult>(async (next) => {
      const secretAskingKit = config.interactiveSecrets
        ? [createSecretAskingKit(next)]
        : [];
      const kits = [...secretAskingKit, ...(await configureKits(config))];

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
