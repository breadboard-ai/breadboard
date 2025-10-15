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
  InputValues,
  Kit,
  NodeDescriptor,
  NodeHandlerContext,
  NodeHandlers,
  NodeIdentifier,
  Outcome,
  OutputValues,
} from "@breadboard-ai/types";
import { err, ok, timestamp } from "@breadboard-ai/utils";
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
    const stream = this.#transport.createClientStream({
      signal: context.signal,
    });
    const writer = stream.writableRequests.getWriter();
    const reader = stream.readableResponses.getReader();

    const inflateToFileData = isGeminiApiFetch(node, inputs);
    let result;
    try {
      const store = context.store;
      inputs = store
        ? ((await inflateData(
            store,
            inputs,
            context.base,
            inflateToFileData
          )) as InputValues)
        : inputs;
      await writer.write(["proxy", { node, inputs }]);
      await writer.close();

      result = await reader.read();
    } catch (e) {
      return err((e as Error).message);
    }
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

type OpalBackendStepContentChunk = {
  mimetype: string;
  data: string;
};
type OpalBackendStepContent = {
  chunks: OpalBackendStepContentChunk[];
};

type OpalBackendBody = {
  execution_inputs: Record<string, OpalBackendStepContent>;
  planStep: {
    modelApi?: string;
  };
  output_gcs_config?: {
    bucket_name: string;
  };
};

type OpalBackendInputs = {
  body: OpalBackendBody;
};

type TransformOutput = {
  part: {
    storedData: {
      handle: string;
      bucketId: string;
      mimeType: string;
    };
  };
};

const APIS_REQUIRING_GCS: string[] = [
  "image_generation",
  "ai_image_editing",
  "ai_image_tool",
  "tts",
  "generate_video",
  "generate_music",
];

function isOpalBackend(data: InputValues): data is OpalBackendInputs {
  if (data === null || typeof data !== "object" || !("body" in data)) {
    return false;
  }
  const body = data.body as Record<string, unknown>;
  if (body === null || typeof body !== "object" || !("planStep" in body)) {
    return false;
  }
  const planStep = body.planStep as Record<string, unknown>;
  const modelApi = planStep["modelApi"] as string;
  if (!APIS_REQUIRING_GCS.includes(modelApi)) {
    return false;
  }
  if (!("execution_inputs" in body)) {
    return false;
  }
  return true;
}

async function transformDriveIdToBlobId(
  driveId: string,
  mimeType: string
): Promise<Outcome<TransformOutput>> {
  return err(`NotImplemented`);
}

async function convertToGcsReferences(
  body: OpalBackendBody
): Promise<Outcome<void>> {
  for (const [key, input] of Object.entries(body.execution_inputs)) {
    const newChunks: OpalBackendStepContentChunk[] = [];
    for (const chunk of input.chunks) {
      if (chunk.mimetype.startsWith("storedData/")) {
        const mimeType =
          chunk.mimetype.replace("storedData/", "") || "image/png";
        const storedHandle = chunk.data;
        let blobId;
        if (storedHandle.startsWith("drive:/")) {
          const driveId = storedHandle.replace(/^drive:\/+/, "");
          console.log("Getting Blob from Drive ID: ", driveId);
          const transforming = await transformDriveIdToBlobId(
            driveId,
            mimeType
          );
          if (!ok(transforming)) return transforming;
        } else {
          blobId = storedHandle.split("/").slice(-1)[0];
        }
        const gcsPath = `${bucketName}/${blobId}`;
        chunk.data = btoa(gcsPath);
        chunk.mimetype = "text/gcs-path";
      }
      newChunks.push(chunk);
    }
    body.execution_inputs[key] = {
      chunks: newChunks,
    };
  }
}
