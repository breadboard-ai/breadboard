/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreadboardRunResult,
  InputValues,
  NodeHandlerContext,
  OutputValues,
  RunnerLike,
} from "../types.js";
import { ClientTransport } from "./protocol.js";

export class Client implements RunnerLike {
  #transport: ClientTransport;

  constructor(clientTransport: ClientTransport) {
    this.#transport = clientTransport;
  }

  async *run(
    context?: NodeHandlerContext,
    result?: BreadboardRunResult
  ): AsyncGenerator<BreadboardRunResult> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    yield result!;
  }
  async runOnce(
    inputs: InputValues,
    _context?: NodeHandlerContext
  ): Promise<OutputValues> {
    const stream = this.#transport.createClientStream();
    const responses = stream.readableResponses;
    const requests = stream.writableRequests.getWriter();

    let outputs;

    await requests.write(["run", {}]);
    for await (const response of responses) {
      const [type, , state] = response;
      if (type === "input") {
        // TODO: Support interruptibility.
        await requests.write(["input", { inputs }, state]);
      } else if (type === "output") {
        const [, output] = response;
        outputs = output.outputs;
        break;
      }
    }
    await responses.cancel();
    await requests.close();
    return outputs || {};
  }
}
