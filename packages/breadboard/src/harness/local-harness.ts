/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Harness,
  HarnessConfig,
  HarnessRunResult,
  SecretHandler,
} from "./types.js";
import { createOnSecret } from "./secrets.js";
import { KitBuilder } from "../kits/builder.js";
import { InputValues } from "../types.js";
import { asRuntimeKit } from "../kits/ctors.js";
import { ProxyClient } from "../remote/proxy.js";
import { HTTPClientTransport } from "../remote/http.js";
import { asyncGen } from "../utils/async-gen.js";
import { Board } from "../board.js";
import { Diagnostics } from "./diagnostics.js";
import { BoardRunner } from "../runner.js";
import { LocalResult } from "./result.js";

export class LocalHarness implements Harness {
  #config: HarnessConfig;
  #runner: BoardRunner | undefined;

  constructor(config: HarnessConfig) {
    this.#config = config;
  }

  #configureKits(onSecret: SecretHandler) {
    let kits = this.#config.kits;
    // Because we're in the browser, we need to ask for secrets from the user.
    // Add a special kit that overrides the `secrets` handler to ask the user
    // for secrets.
    const secretAskingKit = new KitBuilder({
      url: "secret-asking-kit",
    }).build({
      secrets: async (inputs) => {
        return await onSecret(inputs as InputValues);
      },
    });
    kits = [asRuntimeKit(secretAskingKit), ...kits];

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

  async load() {
    const url = this.#config.url;
    const runner = await Board.load(url);

    const { title, description, version } = runner;
    const diagram = runner.mermaid("TD", true);
    const nodes = runner.nodes;

    this.#runner = runner;
    return { title, description, version, diagram, url, nodes };
  }

  async *run() {
    yield* asyncGen<HarnessRunResult>(async (next) => {
      if (!this.#runner) {
        throw new Error("Harness not loaded. Please call 'load' first.");
      }

      const kits = this.#configureKits(createOnSecret(next));

      try {
        const probe = this.#config.diagnostics
          ? new Diagnostics(async (message) => {
              if (
                message.type === "graphstart" ||
                message.type === "graphend"
              ) {
                await next(new LocalResult(message));
              } else {
                next(new LocalResult(message));
              }
            })
          : undefined;

        for await (const data of this.#runner.run({ probe, kits })) {
          const { type } = data;
          if (type === "input") {
            const inputResult = new LocalResult({ type, data });
            await next(inputResult);
            data.inputs = inputResult.response as InputValues;
          } else if (type === "output") {
            await next(new LocalResult({ type, data }));
          }
        }
        await next(new LocalResult({ type: "end", data: {} }));
      } catch (e) {
        let error = e as Error;
        let message = "";
        while (error?.cause) {
          error = (error.cause as { error: Error }).error;
          message += `\n${error.message}`;
        }
        console.error(message, error);
        await next(new LocalResult({ type: "error", data: { error } }));
      }
    });
  }
}
