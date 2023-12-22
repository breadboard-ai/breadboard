/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HostRuntime, RunResult } from "@google-labs/breadboard/worker";
import { HarnessConfig, SecretHandler } from "./types";
import { ProxyReceiver } from "./receiver";
import { ProxyPromiseResponse } from "@google-labs/breadboard/remote";

export class WorkerHarness extends HostRuntime {
  #config: HarnessConfig;
  #onSecret: SecretHandler;

  constructor(config: HarnessConfig, onSecret: SecretHandler) {
    const workerURL = config.remote && config.remote.url;
    if (!workerURL) {
      throw new Error("Worker harness requires a worker URL");
    }
    super(workerURL);
    this.#config = config;
    this.#onSecret = onSecret;
  }

  override async *run(url: string) {
    const receiver = new ProxyReceiver(this.#config, this.#onSecret);
    const proxyNodes = (this.#config.proxy?.[0]?.nodes ?? []).map((node) => {
      return typeof node === "string" ? node : node.node;
    });
    for await (const result of super.run(url, proxyNodes)) {
      const { type, data } = result.message;
      if (type === "proxy") {
        try {
          const handledResult = await receiver.handle(
            data as ProxyPromiseResponse
          );
          result.reply(handledResult.value);
          continue;
        } catch (e) {
          const err = e as Error;
          yield { message: { type: "error", data: err.message } } as RunResult;
        }
      }
      yield result;
    }
  }
}
