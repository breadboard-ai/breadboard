/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "../board.js";
import { callHandler } from "../handler.js";
import { NodeHandlers } from "../types.js";
import {
  AnyProxyRequestMessage,
  AnyProxyResponseMessage,
  ServerTransport,
} from "./protocol.js";

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
