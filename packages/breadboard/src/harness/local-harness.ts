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
import { Board } from "../board.js";
import { Diagnostics } from "./diagnostics.js";
import {
  endResult,
  errorResult,
  fromProbe,
  fromRunnerResult,
} from "./result.js";

export class LocalHarness implements Harness {
  #config: HarnessConfig;

  constructor(config: HarnessConfig) {
    this.#config = config;
  }

  #configureKits(next: (result: HarnessRunResult) => Promise<void>) {
    let kits = this.#config.kits;
    // Because we're in the browser, we need to ask for secrets from the user.
    // Add a special kit that overrides the `secrets` handler to ask the user
    // for secrets.
    kits = [createSecretAskingKit(next), ...kits];

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
    const runner = await Board.load(this.#config.url);

    yield* asyncGen<HarnessRunResult>(async (next) => {
      const kits = this.#configureKits(next);

      try {
        const probe = this.#config.diagnostics
          ? new Diagnostics(async (message) => {
              await next(fromProbe(message));
            })
          : undefined;

        for await (const data of runner.run({ probe, kits })) {
          await next(fromRunnerResult(data));
        }
        await next(endResult());
      } catch (e) {
        let error = e as Error;
        let message = "";
        while (error?.cause) {
          error = (error.cause as { error: Error }).error;
          message += `\n${error.message}`;
        }
        console.error(message, error);
        await next(errorResult(message));
      }
    });
  }
}
