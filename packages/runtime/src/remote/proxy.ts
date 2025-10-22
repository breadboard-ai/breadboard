/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deflateData, inflateData } from "@breadboard-ai/data";
import type {
  AnyProxyRequestMessage,
  AnyProxyResponseMessage,
  ErrorResponse,
  OutputValues,
} from "@breadboard-ai/types";
import { timestamp } from "@breadboard-ai/utils";
import { callHandler, handlersFromKits } from "../handler.js";
import { streamsToAsyncIterable } from "../stream.js";
import { NodeProxyConfig, NodeProxySpec, ProxyServerConfig } from "./config.js";
import { createTunnelKit, readConfig } from "./tunnel.js";
import { ServerTransport } from "./types.js";

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
        let outputs = result;
        if (store) {
          outputs = (await inflateData(
            store,
            makeSerializable(result)
          )) as OutputValues;
          // This is currently the only use of deflateData and we probably
          // should rethink what inflateData/deflateData even mean in the
          // current setup.
          // All it does is takes the inlineData and turns it into storedData
          // that is backed by GoogleBlobStore
          outputs = (await deflateData(store, outputs)) as OutputValues;
        }
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
