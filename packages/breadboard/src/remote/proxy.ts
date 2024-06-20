/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { callHandler, handlersFromKits } from "../handler.js";
import { streamsToAsyncIterable } from "../stream.js";
import { asRuntimeKit } from "../kits/ctors.js";
import { KitBuilder } from "../kits/builder.js";
import {
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  OutputValues,
} from "../types.js";
import { NodeProxyConfig, NodeProxySpec, ProxyServerConfig } from "./config.js";
import {
  AnyProxyRequestMessage,
  AnyProxyResponseMessage,
  ClientBidirectionalStream,
  ClientTransport,
  ServerTransport,
} from "./protocol.js";
import { createTunnelKit, readConfig } from "./tunnel.js";
import { timestamp } from "../timestamp.js";
import { inflateData } from "../data/inflate-deflate.js";

type ProxyServerTransport = ServerTransport<
  AnyProxyRequestMessage,
  AnyProxyResponseMessage
>;

const getHandlerConfig = (
  type: string,
  config: NodeProxyConfig = []
): NodeProxySpec | undefined => {
  const handlerConfig = config.find((arg) => {
    if (typeof arg === "string") return arg === type;
    else return arg.node === type;
  });
  if (typeof handlerConfig === "string") {
    return {
      node: handlerConfig,
    };
  }
  return handlerConfig;
};

export class ProxyServer {
  #transport: ProxyServerTransport;

  constructor(transport: ProxyServerTransport) {
    this.#transport = transport;
  }

  async serve(config: ProxyServerConfig) {
    const { kits, store } = config;
    const stream = this.#transport.createServerStream();
    const tunnelKit = createTunnelKit(
      readConfig(config),
      handlersFromKits(kits)
    );
    const handlers = tunnelKit.handlers;

    for await (const request of streamsToAsyncIterable(
      stream.writableResponses,
      stream.readableRequests
    )) {
      const [type] = request.data;

      if (type === "end") {
        break;
      }

      if (type !== "proxy") {
        request.reply([
          "error",
          { error: "Expected proxy request.", timestamp: timestamp() },
        ]);
        continue;
      }

      const [, { node, inputs }] = request.data;
      const handlerConfig = getHandlerConfig(node.type, config.proxy);

      const handler = handlerConfig ? handlers[node.type] : undefined;
      if (!handler) {
        request.reply([
          "error",
          {
            error: "Can't proxy a node of this node type.",
            timestamp: timestamp(),
          },
        ]);
        continue;
      }

      try {
        const result = await callHandler(handler, inputs, {
          descriptor: node,
          store,
        });

        if (!result) {
          request.reply([
            "error",
            { error: "Handler returned nothing.", timestamp: timestamp() },
          ]);
          continue;
        }
        const outputs = store
          ? ((await inflateData(store, result)) as OutputValues)
          : result;
        request.reply(["proxy", { outputs }]);
      } catch (e) {
        request.reply([
          "error",
          { error: (e as Error).message, timestamp: timestamp() },
        ]);
      }
    }
  }
}

type ProxyClientTransport = ClientTransport<
  AnyProxyRequestMessage,
  AnyProxyResponseMessage
>;

export class ProxyClient {
  #transport: ProxyClientTransport;

  constructor(transport: ProxyClientTransport) {
    this.#transport = transport;
  }

  shutdownServer() {
    const stream = this.#transport.createClientStream();
    const writer = stream.writableRequests.getWriter();
    writer.write(["end", { timestamp: timestamp() }]);
    writer.close();
  }

  async proxy(
    node: NodeDescriptor,
    inputs: InputValues,
    _context: NodeHandlerContext
  ): Promise<OutputValues> {
    const stream = this.#transport.createClientStream();
    const writer = stream.writableRequests.getWriter();
    const reader = stream.readableResponses.getReader();

    writer.write(["proxy", { node, inputs }]);
    writer.close();

    const result = await reader.read();
    if (result.done)
      throw new Error("Unexpected proxy failure: empty response.");

    const [type] = result.value;
    if (type === "proxy") {
      const [, { outputs }] = result.value;
      return outputs;
    } else if (type === "error") {
      const [, { error }] = result.value;
      throw new Error(JSON.stringify(error));
    } else {
      throw new Error(
        `Unexpected proxy failure: unknown response type "${type}".`
      );
    }
  }

  createProxyKit(args: NodeProxyConfig = []) {
    const nodesToProxy = args.map((arg) => {
      if (typeof arg === "string") return arg;
      else return arg.node;
    });
    const proxiedNodes = Object.fromEntries(
      nodesToProxy.map((type) => {
        return [
          type,
          {
            invoke: async (
              inputs: InputValues,
              context: NodeHandlerContext
            ) => {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const descriptor = context.descriptor!;
              const result = await this.proxy(descriptor, inputs, context);
              return result;
            },
          },
        ];
      })
    );
    return asRuntimeKit(new KitBuilder({ url: "proxy" }).build(proxiedNodes));
  }
}

class NullClientTransport<AnyProxyRequestMessage, AnyProxyResponseMessage>
  implements ClientTransport<AnyProxyRequestMessage, AnyProxyResponseMessage>
{
  createClientStream(): ClientBidirectionalStream<
    AnyProxyRequestMessage,
    AnyProxyResponseMessage
  > {
    throw new Error("Method not implemented.");
  }
}

export class SimplePythonProxyClient extends ProxyClient {
  #url: string;

  constructor(url: string) {
    super(new NullClientTransport());
    this.#url = url;
  }

  shutdownServer() {}

  async proxy(
    node: NodeDescriptor,
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> {
    const board_url = context.board!.url!;
    const node_id = context.descriptor!.id!;
    const res = await fetch(
      this.#url +
        "?" +
        new URLSearchParams({
          board_url: board_url,
          node_id: node_id,
        })
    );

    return res.json();
  }
}
