/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "../board.js";
import { callHandler } from "../handler.js";
import { RunResult } from "../run.js";
import { BoardRunner } from "../runner.js";
import { NodeHandlerContext, NodeHandlers } from "../types.js";
import {
  AnyProxyRequestMessage,
  AnyProxyResponseMessage,
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

type ProxyServerTransport = ServerTransport<
  AnyProxyRequestMessage,
  AnyProxyResponseMessage
>;

export class ProxyServer {
  #transport: ProxyServerTransport;

  constructor(transport: ProxyServerTransport) {
    this.#transport = transport;
  }

  async serve(board: Board) {
    const stream = this.#transport.createServerStream();
    const reader = stream.readableRequests.getReader();
    const request = await reader.read();
    if (request.done) return;

    const writer = stream.writableResponses.getWriter();

    const [type] = request.value;

    if (type !== "proxy") {
      writer.write(["error", { error: "Expected proxy request." }]);
      writer.close();
      return;
    }

    const [, { node, inputs }] = request.value;

    const handlers: NodeHandlers = await Board.handlersFromBoard(board);
    const handler = handlers[node.type];
    if (!handler) {
      writer.write(["error", { error: "Unknown node type." }]);
      writer.close();
      return;
    }

    try {
      const result = await callHandler(handler, inputs, {
        outerGraph: board,
        board: board,
        descriptor: node,
        slots: {},
      });

      if (!result) {
        writer.write(["error", { error: "Handler returned nothing." }]);
        writer.close();
        return;
      }

      writer.write(["proxy", { outputs: result }]);
      writer.close();
    } catch (e) {
      writer.write(["error", { error: (e as Error).message }]);
      writer.close();
    }
  }
}
