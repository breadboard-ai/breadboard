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
import { GoogleStorageBlobStore } from "../blob-store.js";
import type { ServerConfig } from "../config.js";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import type { FetchInputs } from "@breadboard-ai/types";
import type { Request } from "express";
import { getAccessToken } from "../auth.js";

export { GcsAndCredsAwareFetch };

type Chunk = {
  mimetype: string;
  data: string;
};
type StepContent = {
  chunks: Chunk[];
};

class GcsAndCredsAwareFetch {
  static #instance: GcsAndCredsAwareFetch | undefined;

  constructor(public readonly serverConfig: ServerConfig) {}

  #processFetchInputs(
    bucketName: string,
    serverUrl: string,
    inputs: InputValues
  ) {
    return prepareGcsData(inputs, bucketName, serverUrl);
  }

  #addAuthToken(request: Request, inputs: InputValues): InputValues {
    const fetchInputs = { ...inputs } as FetchInputs;
    fetchInputs.headers = {
      ...fetchInputs.headers,
      Authorization: `Bearer ${getAccessToken(request)}`,
    };
    return fetchInputs as InputValues;
  }

  #procesFetchOutputs(serverUrl: string, outputs: OutputValues | void) {
    if (!serverUrl || !outputs) {
      return outputs;
    }
    return blobifyStepOutputs(serverUrl, outputs);
  }

  createKit(request: Request, nestedKit: Kit): Kit {
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
          const serverUrl = this.serverConfig.serverUrl;
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

          const inputsWithAuth = this.#addAuthToken(request, updatedInputs);

          // ... call the nested fetch ...
          const outputs = await callHandler(
            nestedFetch,
            inputsWithAuth,
            context
          );

          // ... and process outputs.
          const updatedOutputs = this.#procesFetchOutputs(serverUrl, outputs);

          return updatedOutputs;
        },
      },
    };
  }

  static instance(config: ServerConfig): GcsAndCredsAwareFetch {
    if (!GcsAndCredsAwareFetch.#instance) {
      GcsAndCredsAwareFetch.#instance = new GcsAndCredsAwareFetch(config);
    }
    return GcsAndCredsAwareFetch.#instance;
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
  const driveClient = new GoogleDriveClient({
    getUserAccessToken: async () => accessToken,
  });
  const gettingMedia = await driveClient.getFileMedia(driveId);
  const arrayBuffer = await gettingMedia.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
