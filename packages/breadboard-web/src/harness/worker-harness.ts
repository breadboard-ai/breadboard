/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HostRuntime, RunResult } from "@google-labs/breadboard/worker";
import { SecretHandler } from "./types";
import { ProxyReceiver } from "./receiver";
import { ProxyPromiseResponse } from "@google-labs/breadboard/remote";

export class WorkerHarness extends HostRuntime {
  #secretHandler: SecretHandler;

  constructor(workerURL: string, secretHandler: SecretHandler) {
    super(workerURL);
    this.#secretHandler = secretHandler;
  }

  override async *run(url: string, proxyNodes: string[]) {
    const receiver = new ProxyReceiver(proxyNodes, this.#secretHandler);
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
