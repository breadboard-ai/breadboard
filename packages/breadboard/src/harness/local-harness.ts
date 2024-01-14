/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Harness, HarnessConfig, HarnessRunResult } from "./types.js";
import { createSecretAskingKit } from "./secrets.js";
import { ProxyClient } from "../remote/proxy.js";
import { HTTPClientTransport } from "../remote/http.js";
import { asyncGen } from "../utils/async-gen.js";
import { runLocally } from "./local.js";

export class LocalHarness implements Harness {
  #config: HarnessConfig;

  constructor(config: HarnessConfig) {
    this.#config = config;
  }

  #configureKits() {
    let kits = this.#config.kits;
    // If a proxy is configured, add the proxy kit to the list of kits.
    // Note, this may override the `secrets` handler from the SecretAskingKit.
    const proxyConfig = this.#config.proxy?.[0];
    if (proxyConfig) {
      if (proxyConfig.location === "http") {
        if (!proxyConfig.url) {
          throw new Error("No node proxy server URL provided.");
        }
        const proxyClient = new ProxyClient(
          new HTTPClientTransport(proxyConfig.url)
        );
        kits = [proxyClient.createProxyKit(proxyConfig.nodes), ...kits];
      } else {
        throw new Error(
          "Only HTTP node proxy server is supported at this time."
        );
      }
    }
    return kits;
  }

  async *run() {
    yield* asyncGen<HarnessRunResult>(async (next) => {
      const kits = [createSecretAskingKit(next), ...this.#configureKits()];

      for await (const data of runLocally(this.#config, kits)) {
        await next(data);
      }
    });
  }
}
