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
import { GoogleStorageBlobStore } from "../blob-store.js";
import { initializeDriveClient } from "../boards/assets-drive.js";
import type { ServerConfig } from "../config.js";
import type { access } from "fs";

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

  #processFetchInputs(
    bucketName: string,
    serverUrl: string,
    inputs: InputValues
  ) {
    return prepareGcsData(inputs, bucketName, serverUrl);
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
            console.log(
              `No server URL (${serverUrl}) or storage bucket (${storageBucket}) found`
            );
            // If no server URL found at all, just do the usual fetch handler.
            return callHandler(nestedFetch, inputs, context);
          }

          // Otherwise, process inputs ...
          const updatedInputs = await this.#processFetchInputs(
            storageBucket,
            serverUrl,
            inputs
          );

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

async function prepareGcsData(
  data: InputValues,
  bucketName: string,
  serverUrl: string
): Promise<InputValues> {
  let accessToken = "";
  if (data !== null && typeof data === "object" && "headers" in data) {
    const headers = data.headers as Record<string, string>;
    accessToken = headers?.Authorization || "";
    accessToken = accessToken.replace("Bearer ", "");
  }
  const blobStore = new GoogleStorageBlobStore(bucketName, serverUrl);
  const apiRequiresGcs: string[] = [
    "image_generation",
    "ai_image_editing",
    "ai_image_tool",
    "tts",
    "generate_video",
    "generate_music",
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
  console.log("Set output_gcs_config: ", gcsOutputConfig);
  await convertToGcsReferences(body, blobStore, bucketName, accessToken);
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

const maybeGetExecutionInputs = (
  body: object
): Record<string, unknown> | undefined => {
  if ("execution_inputs" in body) {
    const { execution_inputs } = body;
    return execution_inputs as Record<string, StepContent>;
  }
};

async function convertToGcsReferences(
  body: object,
  blobStore: GoogleStorageBlobStore,
  bucketName: string,
  accessToken: string
) {
  console.log("Converting to GCS references");
  const executionInputs = maybeGetExecutionInputs(body);
  if (!executionInputs) {
    return;
  }
  for (const key of Object.keys(executionInputs)) {
    const input = executionInputs[key] as StepContent;
    const newChunks: Chunk[] = [];
    for (const chunk of input.chunks) {
      if (chunk.mimetype.startsWith("storedData/")) {
        const mimetype =
          chunk.mimetype.replace("storedData/", "") || "image/png";
        const storedHandle = chunk.data;
        let blobId;
        if (storedHandle.startsWith("drive:/")) {
          const driveId = storedHandle.replace(/^drive:\/+/, "");
          console.log("Fetching Drive ID: ", driveId);
          const arrayBuffer = await fetchDriveAssetAsBuffer(
            driveId,
            accessToken
          );
          // Store temporarily in GCS as file transfer mechanism.
          blobId = await blobStore.saveBuffer(arrayBuffer, mimetype);
        } else {
          blobId = storedHandle.split("/").slice(-1)[0];
        }
        const gcsPath = `${bucketName}/${blobId}`;
        chunk.data = btoa(gcsPath);
        chunk.mimetype = "text/gcs-path";
      }
      newChunks.push(chunk);
    }
    executionInputs[key] = {
      chunks: newChunks,
    };
  }
}

// Fetch media asset from long term  storage in Drive.
async function fetchDriveAssetAsBuffer(driveId: string, accessToken: string) {
  const driveClient = initializeDriveClient(accessToken, "");
  const gettingMedia = await driveClient.getFileMedia(driveId);
  const arrayBuffer = await gettingMedia.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
