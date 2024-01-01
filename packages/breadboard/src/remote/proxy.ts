/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { callHandler, handlersFromKits } from "../handler.js";
import {
  StreamCapability,
  StreamCapabilityType,
  isStreamCapability,
  streamsToAsyncIterable,
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

  async serve(config: ProxyServerConfig) {
    const { kits } = config;
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
        request.reply(["error", { error: "Expected proxy request." }]);
        continue;
      }

      const [, { node, inputs }] = request.data;
      const handlerConfig = getHandlerConfig(node.type, config.proxy);

      const handler = handlerConfig ? handlers[node.type] : undefined;
      if (!handler) {
        request.reply([
          "error",
          { error: "Can't proxy a node of this node type." },
        ]);
        continue;
      }

      try {
        const result = await callHandler(handler, inputs, {
          descriptor: node,
        });

        if (!result) {
          request.reply(["error", { error: "Handler returned nothing." }]);
          continue;
        }

        // Look for StreamCapability in the result. If it's there, we need to
        // pipe it to the response.
        // For now, we'll only support one stream per response, and only
        // when the stream is at the top level of the response.
        const streams = Object.values(result).filter((value) =>
          isStreamCapability(value)
        );
        request.reply(["proxy", { outputs: result }]);
        if (streams.length > 0) {
          const stream = (streams[0] as StreamCapability<unknown>).stream;
          await stream.pipeTo(
            new WritableStream({
              write(chunk) {
                request.reply(["chunk", { chunk }]);
              },
              close() {
                request.reply(["end", {}]);
              },
            })
          );
        }
      } catch (e) {
        request.reply(["error", { error: (e as Error).message }]);
      }
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

  shutdownServer() {
    const stream = this.#transport.createClientStream();
    const writer = stream.writableRequests.getWriter();
    writer.write(["end", {}]);
    writer.close();
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
