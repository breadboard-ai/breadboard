/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult, Kit, RunConfig } from "@breadboard-ai/types";
import { HTTPClientTransport } from "../remote/http.js";
import { ProxyClient } from "../remote/proxy.js";
import { runLocally } from "./local.js";
import { configureSecretAsking } from "./secrets.js";
import { asyncGen } from "@breadboard-ai/utils";

export { run, configureKits };

async function configureKits(
  config: RunConfig,
  next: (data: HarnessRunResult) => Promise<void>
): Promise<Kit[]> {
  return configureSecretAsking(
    config.interactiveSecrets,
    await configureProxy(config),
    next
  );
}

async function configureProxy(config: RunConfig): Promise<Kit[]> {
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
            new HTTPClientTransport(proxyConfig.url, {
              signal: config.signal,
            })
          );
          kits.push(proxyClient.createProxyKit(proxyConfig.nodes, config.kits));
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
}

async function* run(config: RunConfig) {
  if (!config.remote) {
    yield* asyncGen<HarnessRunResult>(async (next) => {
      const kits = await configureKits(config, next);

      for await (const data of runLocally(config, kits)) {
        await next(data);
      }
    });
  } else {
    throw new Error(
      `Unsupported harness configuration: ${JSON.stringify(config, null, 2)}`
    );
  }
}
