/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RunResult } from "../run.js";
import { BoardRunner } from "../runner.js";
import { NodeHandlerContext } from "../types.js";
import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
  ServerTransport,
} from "./protocol.js";

const resumeRun = (request: AnyRunRequestMessage) => {
  const [type, , state] = request;
  const result = state ? RunResult.load(state) : undefined;
  if (result && type === "input") {
    const [, inputs] = request;
    result.inputs = inputs.inputs;
  }
  return result;
};

type RunServerTransport = ServerTransport<
  AnyRunRequestMessage,
  AnyRunResponseMessage
>;

export class RunServer {
  #transport: RunServerTransport;

  constructor(transport: RunServerTransport) {
    this.#transport = transport;
  }

  async serve(runner: BoardRunner, context: NodeHandlerContext = {}) {
    const stream = this.#transport.createServerStream();
    const requestReader = stream.readableRequests.getReader();
    let request = await requestReader.read();
    if (request.done) return;

    const result = resumeRun(request.value);

    const responses = stream.writableResponses.getWriter();
    try {
      for await (const stop of runner.run(context, result)) {
        if (stop.type === "input") {
          const state = await stop.save();
          const { node, inputArguments } = stop;
          await responses.write(["input", { node, inputArguments }, state]);
          request = await requestReader.read();
          if (request.done) {
            await responses.close();
            return;
          } else {
            const [type, inputs] = request.value;
            if (type === "input") {
              stop.inputs = inputs.inputs;
            }
          }
        } else if (stop.type === "output") {
          const { node, outputs } = stop;
          await responses.write(["output", { node, outputs }]);
        } else if (stop.type === "beforehandler") {
          const { node } = stop;
          await responses.write(["beforehandler", { node }]);
        }
      }
      await responses.write(["end", {}]);
      await responses.close();
    } catch (e) {
      await responses.abort(e);
    }
  }
}
