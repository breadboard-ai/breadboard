/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "../board.js";
import { callHandler } from "../handler.js";
import {
  StreamCapability,
  StreamCapabilityType,
  isStreamCapability,
} from "../stream.js";
import { asRuntimeKit } from "../kits/ctors.js";
import { KitBuilder } from "../kits/builder.js";
import {
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  NodeValue,
  OutputValues,
} from "../types.js";
import { NodeProxyConfig, NodeProxySpec, ProxyServerConfig } from "./config.js";
import {
  AnyProxyRequestMessage,
  AnyProxyResponseMessage,
  ClientTransport,
  ServerTransport,
} from "./protocol.js";
import { createTunnelKit, readConfig } from "./tunnel.js";

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

  // TODO: Don't serve board, just serve a list of kits.
  // TODO: Create a VaultKit that wraps nodes that need to be protected.
  // TODO: Handle VaultKit outside of the ProxyServer? Maybe not.
  async serve(config: ProxyServerConfig) {
    const { board } = config;
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

    const handlerConfig = getHandlerConfig(node.type, config.proxy);

    const tunnelKit = createTunnelKit(
      readConfig(config),
      await Board.handlersFromBoard(board)
    );
    const handlers = tunnelKit.handlers;

    const handler = handlerConfig ? handlers[node.type] : undefined;
    if (!handler) {
      writer.write([
        "error",
        { error: "Can't proxy a node of this node type." },
      ]);
      writer.close();
      return;
    }

    try {
      const result = await callHandler(handler, inputs, {
        outerGraph: board,
        board,
        descriptor: node,
      });

      if (!result) {
        writer.write(["error", { error: "Handler returned nothing." }]);
        writer.close();
        return;
      }

      // Look for StreamCapability in the result. If it's there, we need to
      // pipe it to the response.
      // For now, we'll only support one stream per response, and only
      // when the stream is at the top level of the response.
      const streams = Object.values(result).filter((value) =>
        isStreamCapability(value)
      );
      writer.write(["proxy", { outputs: result }]);
      if (streams.length > 0) {
        const stream = (streams[0] as StreamCapability<unknown>).stream;
        await stream.pipeTo(
          new WritableStream({
            write(chunk) {
              writer.write(["chunk", { chunk }]);
            },
            close() {
              writer.write(["end", {}]);
              writer.close();
            },
          })
        );
      } else {
        writer.close();
      }
    } catch (e) {
      writer.write(["error", { error: (e as Error).message }]);
      writer.close();
    }
  }
}

type ProxyClientTransport = ClientTransport<
  AnyProxyRequestMessage,
  AnyProxyResponseMessage
>;

const isStreamCapabilityLike = (value: NodeValue): boolean => {
  if (typeof value !== "object" || value === null) return false;
  const stream = (value as StreamCapabilityType).stream;
  return typeof stream === "object" && stream !== null;
};

export class ProxyClient {
  #transport: ProxyClientTransport;

  constructor(transport: ProxyClientTransport) {
    this.#transport = transport;
  }

  async proxy(
    node: NodeDescriptor,
    inputs: InputValues
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
      // Reinflate StreamCapability for the single output that might be
      // isStreamCapability-like.
      let foundStream = false;
      return Object.fromEntries(
        Object.entries(outputs).map(([name, value]) => {
          if (foundStream || !isStreamCapabilityLike(value))
            return [name, value];
          foundStream = true;
          const stream = new ReadableStream({
            async pull(controller) {
              for (;;) {
                const result = await reader.read();
                if (result.done) {
                  controller.close();
                  return;
                }
                const [type] = result.value;
                if (type === "chunk") {
                  const [, { chunk }] = result.value;
                  controller.enqueue(chunk);
                } else if (type === "end") {
                  controller.close();
                  return;
                } else {
                  throw new Error(
                    `Unexpected proxy failure: unknown response type "${type}".`
                  );
                }
              }
            },
          });
          return [name, new StreamCapability(stream)];
        })
      );
    } else if (type === "error") {
      const [, { error }] = result.value;
      throw new Error(error);
    } else {
      throw new Error(
        `Unexpected proxy failure: unknown response type "${type}".`
      );
    }
  }

  createProxyKit(args: NodeProxyConfig) {
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
              const result = await this.proxy(descriptor, inputs);
              return result;
            },
          },
        ];
      })
    );
    return asRuntimeKit(new KitBuilder({ url: "proxy" }).build(proxiedNodes));
  }
}
