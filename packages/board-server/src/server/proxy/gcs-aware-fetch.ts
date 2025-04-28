/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  callHandler,
  type InputValues,
  type Kit,
  type NodeHandlerContext,
  type OutputValues,
} from "@google-labs/breadboard";
import type { BoardServerStore, ServerInfo } from "../store.js";
import type { ServerConfig } from "../config.js";

export { GcsAwareFetch };

type Chunk = {
  mimetype: string;
  data: string;
};
type StepContent = {
  chunks: Chunk[];
};

class GcsAwareFetch {
  static #instance: GcsAwareFetch | undefined;

  private readonly serverInfo: Promise<ServerInfo | null>;

  constructor(
    store: BoardServerStore,
    public readonly serverConfig: ServerConfig
  ) {
    this.serverInfo = store.getServerInfo();
  }

  #processFetchInputs(bucketName: string, inputs: InputValues) {
    return maybeAddGcsOutputConfig(inputs, bucketName);
  }

  #procesFetchOutputs(serverUrl: string, outputs: OutputValues | void) {
    if (!serverUrl || !outputs) {
      return outputs;
    }
    return blobifyStepOutputs(serverUrl, outputs);
  }

  createKit(nestedKit: Kit): Kit {
    const nestedFetch = nestedKit.handlers.fetch;
    if (!nestedFetch) {
      throw new Error(`Invalid argument: unable to find "fetch" handler`);
    }

    return {
      url: "server://gcs-aware-fetch", // any URL would do
      handlers: {
        fetch: async (
          inputs: InputValues,
          context: NodeHandlerContext
        ): Promise<OutputValues | void> => {
          const serverInfo = await this.serverInfo;
          const serverUrl = this.serverConfig.serverUrl || serverInfo?.url;
          const storageBucket = this.serverConfig.storageBucket;
          if (!serverUrl || !storageBucket) {
            // If no server URL found at all, just do the usual fetch handler.
            return callHandler(nestedFetch, inputs, context);
          }

          // Otherwise, process inputs ...
          const updatedInputs = this.#processFetchInputs(storageBucket, inputs);

          // ... call the nested fetch ...
          const outputs = await callHandler(
            nestedFetch,
            updatedInputs,
            context
          );

          // ... and process outputs.
          const updatedOutputs = this.#procesFetchOutputs(serverUrl, outputs);

          return updatedOutputs;
        },
      },
    };
  }

  static instance(
    store: BoardServerStore,
    config: ServerConfig
  ): GcsAwareFetch {
    if (!GcsAwareFetch.#instance) {
      GcsAwareFetch.#instance = new GcsAwareFetch(store, config);
    }
    return GcsAwareFetch.#instance;
  }
}

function maybeAddGcsOutputConfig(
  data: InputValues,
  bucketName: string
): InputValues {
  const apiRequiresGcs: string[] = [
    "image_generation",
    "ai_image_editing",
    "ai_image_tool",
    "tts",
    "generate_video",
  ];
  if (data === null || typeof data !== "object" || !("body" in data)) {
    return data;
  }
  const body = data.body as Record<string, unknown>;
  if (body === null || typeof body !== "object" || !("planStep" in body)) {
    return data;
  }
  const planStep = body.planStep as Record<string, unknown>;
  const modelApi = planStep["modelApi"] as string;
  if (!apiRequiresGcs.includes(modelApi)) {
    return data;
  }
  const gcsOutputConfig = {
    bucket_name: bucketName,
  };
  body["output_gcs_config"] = gcsOutputConfig;
  return data;
}

export const blobifyStepOutputs = (
  serverUrl: string,
  data: OutputValues
): OutputValues => {
  const result = data;
  const executionOutputs = maybeGetExecutionOutputs(data);
  if (!executionOutputs) {
    return result;
  }
  for (const key of Object.keys(executionOutputs)) {
    const output = executionOutputs[key] as StepContent;
    const newChunks: Chunk[] = [];
    for (const chunk of output.chunks) {
      if (chunk.mimetype.startsWith("text/gcs-path")) {
        // The executeStep API returns a mime like: text/gcs-path/real/mimetype.
        const mimetype = chunk.mimetype.replace("text/gcs-path/", "");
        // The executeStep API returns a path like: bucketname/filename.
        const blobId = atob(chunk.data).split("/").slice(-1)[0];
        if (!serverUrl.endsWith("/")) {
          serverUrl += "/";
        }
        const blobUrl = `${serverUrl}blobs/${blobId}`;
        newChunks.push({
          mimetype: mimetype + "/storedData",
          data: blobUrl,
        } as Chunk);
      } else {
        newChunks.push(chunk);
      }
    }
    executionOutputs[key] = {
      chunks: newChunks,
    };
  }
  return result;
};

const maybeGetExecutionOutputs = (
  data: OutputValues
): Record<string, unknown> | undefined => {
  if (typeof data === "object" && data !== null && "response" in data) {
    const { response } = data;
    if (
      typeof response === "object" &&
      response !== null &&
      "executionOutputs" in response
    ) {
      const { executionOutputs } = response;
      return executionOutputs as Record<string, StepContent>;
    }
  }
  return;
};
