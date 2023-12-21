/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HostRuntime, RunResult } from "@google-labs/breadboard/worker";
import { HarnessConfig } from "./types";
import { ProxyReceiver } from "./receiver";
import { ProxyPromiseResponse } from "@google-labs/breadboard/remote";

export class WorkerHarness extends HostRuntime {
  #config: HarnessConfig;

  constructor(workerURL: string, config: HarnessConfig) {
    super(workerURL);
    this.#config = config;
  }

  override async *run(url: string, proxyNodes: string[]) {
    const receiver = new ProxyReceiver(this.#config);
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
