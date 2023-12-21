/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HostRuntime, RunResult } from "@google-labs/breadboard/worker";
import { SecretHandler } from "./types";
import { ProxyReceiver } from "./receiver";
import { InputValues, NodeDescriptor } from "@google-labs/breadboard";

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
          const proxyData = data as {
            node: NodeDescriptor;
            inputs: InputValues;
          };

          // TODO: Find a way to handle this
          // const pending = this.#pending.get(
          //   proxyData.node.id
          // ) as BreadboardUI.HarnessEventType;
          // if (pending) {
          //   this.#pending.delete(proxyData.node.id);
          //   if (pending !== "secrets") {
          //     this.#ui.proxyResult(
          //       pending,
          //       proxyData.node.id,
          //       proxyData.inputs
          //     );
          //   }
          // }

          // // Track the board ID. If it changes while awaiting a result, then
          // // the board has changed and the handled result should be discarded
          // // as it is stale.
          // const boardId = this.#boardId;
          const handledResult = await receiver.handle(proxyData);
          // if (boardId !== this.#boardId) {
          //   console.log("Board has changed; proxy result is stale");
          // } else {
          // if (handledResult.nodeType === "palm-generateText") {
          //   const resultValue = handledResult.value as {
          //     completion: string;
          //   };
          //   this.#ui.result({
          //     title: "LLM Response",
          //     result: resultValue.completion,
          //   });
          // }
          result.reply(handledResult.value);
          // }
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
