/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Diagnostics } from "../harness/diagnostics.js";
import { RunResult } from "../run.js";
import { BoardRunner } from "../runner.js";
import {
  WritableResult,
  streamsToAsyncIterable,
  stubOutStreams,
} from "../stream.js";
import {
  BreadboardRunResult,
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  OutputValues,
  RunResultType,
  TraversalResult,
} from "../types.js";
import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
  ClientTransport,
  RunRequestMessage,
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

  async serve(
    runner: BoardRunner,
    diagnostics = false,
    context: NodeHandlerContext = {}
  ) {
    const stream = this.#transport.createServerStream();
    const requestReader = stream.readableRequests.getReader();
    let request = await requestReader.read();
    if (request.done) return;

    const result = resumeRun(request.value);
    const responses = stream.writableResponses.getWriter();

    const servingContext = {
      ...context,
      probe: diagnostics
        ? new Diagnostics(async ({ type, data }) => {
            const response = [type, stubOutStreams(data)];
            if (type == "nodestart") {
              response.push(data.state);
            }
            await responses.write(response as AnyRunResponseMessage);
          })
        : undefined,
    };

    try {
      for await (const stop of runner.run(servingContext, result)) {
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
        }
      }
      await responses.write(["end", {}]);
      await responses.close();
    } catch (e) {
      let error = e as Error;
      let message = "";
      while (error?.cause) {
        error = (error.cause as { error: Error }).error;
        message += `\n${error.message}`;
      }
      console.error("Run Server error:", error.message);
      await responses.write(["error", { error: message }]);
      await responses.close();
    }
  }
}

class ClientRunResult implements BreadboardRunResult {
  type: RunResultType;
  node: NodeDescriptor;
  invocationId = 0;
  path?: number[];

  #state?: string;
  #inputArguments: InputValues = {};
  #outputs: OutputValues = {};
  #result: WritableResult<AnyRunResponseMessage, AnyRunRequestMessage>;

  constructor(
    result: WritableResult<AnyRunResponseMessage, AnyRunRequestMessage>
  ) {
    this.#result = result;

    const [type, data, state] = result.data;
    this.#state = state;
    this.type = type as RunResultType;
    if (type === "error") {
      throw new Error("Server experienced an error", { cause: data.error });
    }
    if (type !== "graphend" && type !== "graphstart" && type !== "end") {
      this.node = data.node;
    } else {
      // TODO: Remove this hack. Currently necessary, because
      // BreadboardRunResult and ProbeMessages don't mix.
      this.node = undefined as unknown as NodeDescriptor;
    }

    if (
      type === "nodestart" ||
      type === "nodeend" ||
      type === "graphend" ||
      type === "graphstart"
    ) {
      this.path = data.path;
    }

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
    this.#result.reply(["input", { inputs }, this.#state || ""]);
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

type RunClientTransport = ClientTransport<
  AnyRunRequestMessage,
  AnyRunResponseMessage
>;

export class RunClient {
  #transport: RunClientTransport;

  constructor(clientTransport: RunClientTransport) {
    this.#transport = clientTransport;
  }

  async *run(state?: string): AsyncGenerator<BreadboardRunResult> {
    const stream = this.#transport.createClientStream();
    const server = streamsToAsyncIterable(
      stream.writableRequests,
      stream.readableResponses
    );
    const request = ["run", {}] as RunRequestMessage;
    state && request.push(state);
    await server.start(request);
    for await (const response of server) {
      yield new ClientRunResult(response);
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
