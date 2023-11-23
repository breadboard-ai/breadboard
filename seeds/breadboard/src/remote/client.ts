/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RunResult } from "../run.js";
import {
  BreadboardRunResult,
  InputValues,
  NodeDescriptor,
  OutputValues,
  RunResultType,
  RunnerLike,
  TraversalResult,
} from "../types.js";
import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
  RunClientTransport,
} from "./protocol.js";

type Writer = WritableStreamDefaultWriter<AnyRunRequestMessage>;

class ClientRunResult implements BreadboardRunResult {
  type: RunResultType;
  node: NodeDescriptor;

  #state?: string;
  #inputArguments: InputValues = {};
  #outputs: OutputValues = {};
  #requests: Writer;

  constructor(requests: Writer, response: AnyRunResponseMessage) {
    this.#requests = requests;

    const [type, data, state] = response;
    this.#state = state;
    this.type = type as RunResultType;
    if (type === "error") {
      throw new Error("Server experienced an error", { cause: data.error });
    }
    this.node = data.node;

    if (type === "input") {
      this.#inputArguments = data.inputArguments;
    } else if (type === "output") {
      this.#outputs = data.outputs;
    }
  }

  #checkState() {
    if (!this.#state) {
      throw new Error("State was not supplied for this ClientRunResult.");
    }
  }

  set inputs(inputs: InputValues) {
    if (this.type !== "input") return;
    this.#checkState();
    this.#requests.write(["input", { inputs }, this.#state || ""]);
  }

  get outputs(): OutputValues {
    return this.#outputs;
  }

  get inputArguments(): InputValues {
    return this.#inputArguments;
  }

  get state(): TraversalResult {
    this.#checkState();
    const runResult = RunResult.load(this.#state || "");
    return runResult.state;
  }
}

export class RunClient implements RunnerLike {
  #transport: RunClientTransport;

  constructor(clientTransport: RunClientTransport) {
    this.#transport = clientTransport;
  }

  async *run(): AsyncGenerator<BreadboardRunResult> {
    const stream = this.#transport.createClientStream();
    const responses = stream.readableResponses;
    const requests = stream.writableRequests.getWriter();

    await requests.write(["run", {}]);
    try {
      for await (const response of responses) {
        const [type] = response;
        if (type === "proxy") {
          // TODO: Implement proxying.
          throw new Error("Proxying is not yet implemented.");
        } else if (type === "end") {
          break;
        }
        yield new ClientRunResult(requests, response);
      }
    } finally {
      await responses.cancel();
      await requests.close();
    }
  }

  async runOnce(inputs: InputValues): Promise<OutputValues> {
    let outputs;

    for await (const stop of this.run()) {
      if (stop.type === "input") {
        stop.inputs = inputs;
      } else if (stop.type === "output") {
        outputs = stop.outputs;
        break;
      }
    }

    return outputs || {};
  }
}
