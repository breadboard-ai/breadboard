/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Diagnostics } from "../harness/diagnostics.js";
import { RunResult } from "../run.js";
import { BoardRunner } from "../runner.js";
import { loadRunnerState } from "../serialization.js";
import {
  WritableResult,
  streamsToAsyncIterable,
  stubOutStreams,
} from "../stream.js";
import {
  InputValues,
  NodeHandlerContext,
  OutputValues,
  TraversalResult,
} from "../types.js";
import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
  ClientTransport,
  InputResolveRequest,
  RunState,
  RunRequestMessage,
  ServerTransport,
} from "./protocol.js";

const resumeRun = (request: AnyRunRequestMessage) => {
  const [type, , state] = request;
  // TODO: state is probably not a string here,
  // it can also be a traversal result
  const result = state ? RunResult.load(state as string) : undefined;
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

type RunClientTransport = ClientTransport<
  AnyRunRequestMessage,
  AnyRunResponseMessage
>;

type ReplyFunction = {
  reply: (chunk: AnyRunRequestMessage[1]) => Promise<void>;
};

type ClientRunResultFromMessage<ResponseMessage> = ResponseMessage extends [
  string,
  object,
  RunState?
]
  ? {
      type: ResponseMessage[0];
      data: ResponseMessage[1];
      state?: TraversalResult;
    } & ReplyFunction
  : never;

export type AnyClientRunResult =
  ClientRunResultFromMessage<AnyRunResponseMessage>;

export type ClientRunResult<T> = T & ReplyFunction;

const createRunResult = (
  response: WritableResult<AnyRunResponseMessage, AnyRunRequestMessage>
): AnyClientRunResult => {
  const [type, data, state] = response.data;
  const reply = async (chunk: AnyRunRequestMessage[1]) => {
    if (type !== "input") {
      throw new Error(
        "For now, we cannot reply to messages other than 'input'."
      );
    }
    await response.reply([type, chunk as InputResolveRequest, state]);
  };
  const inflateState = (state?: RunState) => {
    if (!state) return undefined;
    return typeof state === "string" ? loadRunnerState(state).state : state;
  };
  return {
    type,
    data,
    state: inflateState(state),
    reply,
  } as AnyClientRunResult;
};

export class RunClient {
  #transport: RunClientTransport;

  constructor(clientTransport: RunClientTransport) {
    this.#transport = clientTransport;
  }

  async *run(state?: string): AsyncGenerator<AnyClientRunResult> {
    const stream = this.#transport.createClientStream();
    const server = streamsToAsyncIterable(
      stream.writableRequests,
      stream.readableResponses
    );
    const request = ["run", {}] as RunRequestMessage;
    state && request.push(state);
    await server.start(request);
    for await (const response of server) {
      yield createRunResult(response);
    }
  }

  async runOnce(inputs: InputValues): Promise<OutputValues> {
    let outputs;

    for await (const stop of this.run()) {
      const { type, data } = stop;
      if (type === "input") {
        stop.reply({ inputs });
      } else if (type === "output") {
        outputs = data.outputs;
        break;
      }
    }

    return outputs || {};
  }
}
