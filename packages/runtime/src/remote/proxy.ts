/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inflateData } from "@breadboard-ai/data";
import type {
  AnyProxyRequestMessage,
  AnyProxyResponseMessage,
  ErrorResponse,
  InputValues,
  Kit,
  NodeDescriptor,
  NodeHandlerContext,
  NodeHandlers,
  NodeIdentifier,
  OutputValues,
} from "@breadboard-ai/types";
import { timestamp } from "@breadboard-ai/utils";
import { callHandler, handlersFromKits } from "../handler.js";
import { streamsToAsyncIterable } from "../stream.js";
import { NodeProxyConfig, NodeProxySpec, ProxyServerConfig } from "./config.js";
import { createTunnelKit, readConfig } from "./tunnel.js";
import { ClientTransport, ServerTransport } from "./types.js";

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

const makeSerializable = (data: OutputValues) => {
  if (data["$error"]) {
    const error = data["$error"] as ErrorResponse;
    error.error =
      error.error instanceof Error ? error.error.message : error.error;
  }
  return data;
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
        const allowed = config.allowed?.(node, inputs);
        if (allowed === false) {
          request.reply([
            "error",
            {
              error: "This proxy request is not allowed",
              timestamp: timestamp(),
            },
          ]);
          continue;
        }
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
          ? ((await inflateData(
              store,
              makeSerializable(result)
            )) as OutputValues)
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
    context: NodeHandlerContext
  ): Promise<OutputValues> {
    const stream = this.#transport.createClientStream();
    const writer = stream.writableRequests.getWriter();
    const reader = stream.readableResponses.getReader();

    const inflateToFileData = isGeminiApiFetch(node, inputs);

    const store = context.store;
    inputs = store
      ? ((await inflateData(
          store,
          inputs,
          context.base,
          inflateToFileData
        )) as InputValues)
      : inputs;
    writer.write(["proxy", { node, inputs }]);
    writer.close();

    const result = await reader.read();
    if (result.done) {
      throw new Error("Unexpected proxy failure: empty response.");
    }

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

  createProxyKit(args: NodeProxyConfig = [], fallback: Kit[] = []) {
    const fallbackHandlers = handlersFromKits(fallback);
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
              if (keepLocal(descriptor, inputs)) {
                return invokeFallback(type, inputs, context, fallbackHandlers);
              }
              const result = await this.proxy(descriptor, inputs, context);
              return result;
            },
          },
        ];
      })
    );
    return {
      url: "proxy",
      handlers: proxiedNodes,
    } satisfies Kit;
  }
}

async function invokeFallback(
  id: NodeIdentifier,
  inputs: InputValues,
  context: NodeHandlerContext,
  fallbackHandlers: NodeHandlers
): Promise<void | OutputValues> {
  const handler = fallbackHandlers[id];
  return callHandler(handler, inputs, context);
}

/**
 * A helper that lets the proxy know not to proxy the handler
 */
function keepLocal(node: NodeDescriptor, inputs: InputValues): boolean {
  if (node.type !== "fetch") return false;
  // We can't handle file system-based fetch on the proxy server.
  return "file" in inputs;
}

function isGeminiApiFetch(node: NodeDescriptor, inputs: InputValues): boolean {
  if (node.type !== "fetch") return false;
  return (
    "url" in inputs &&
    !!inputs.url &&
    typeof inputs.url === "string" &&
    inputs.url.startsWith("https://generativelanguage.googleapis.com")
  );
}
