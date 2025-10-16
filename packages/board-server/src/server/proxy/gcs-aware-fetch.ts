/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import type { FetchInputs, Outcome } from "@breadboard-ai/types";
import { createFetchWithCreds, err, ok } from "@breadboard-ai/utils";
import {
  callHandler,
  type InputValues,
  type Kit,
  type NodeHandlerContext,
  type OutputValues,
} from "@google-labs/breadboard";
import type { Request } from "express";
import { getAccessToken } from "../auth.js";
import { GoogleStorageBlobStore } from "../blob-store.js";
import type { ServerConfig } from "../config.js";

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
  ): Promise<Outcome<InputValues>> {
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

          const inputsWithAuth = this.#addAuthToken(request, inputs);

          // Otherwise, process inputs ...
          const updatedInputs = await this.#processFetchInputs(
            storageBucket,
            serverUrl,
            inputsWithAuth
          );
          if (!ok(updatedInputs)) return updatedInputs;

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
): Promise<Outcome<InputValues>> {
  let accessToken = "";
  if (data !== null && typeof data === "object" && "headers" in data) {
    const headers = data.headers as Record<string, string>;
    accessToken = headers?.Authorization || "";
    accessToken = accessToken.replace("Bearer ", "");
  }
  const blobStore = new GoogleStorageBlobStore(bucketName, serverUrl);
  const apiRequiresGcs: string[] = [
    "image_generation", // never sends drive ids
    "ai_image_editing", // isn't called
    "ai_image_tool", // "execution_inputs.input_image.chunk[]"
    "tts", // never sends drive ids
    "generate_video", // one image as "reference_image"
    "generate_music", // never sends drive ids
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
  const converting = await convertToGcsReferences(
    body,
    blobStore,
    bucketName,
    accessToken
  );
  if (!ok(converting)) return converting;
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
): Promise<Outcome<void>> {
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
          const fetchingAsset = await fetchDriveAssetAsBuffer(
            driveId,
            mimetype,
            accessToken
          );
          if (!ok(fetchingAsset)) return fetchingAsset;
          const { buffer, mimeType } = fetchingAsset;
          if (mimeType.startsWith("text/")) {
            chunk.data = buffer.toString("base64");
            chunk.mimetype = "text/plain";
            newChunks.push(chunk);
            continue;
          }
          // Store temporarily in GCS as file transfer mechanism.
          blobId = await blobStore.saveBuffer(buffer, mimeType);
        } else if (mimetype === "text/gcs-path") {
          newChunks.push(chunk);
          continue;
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
      chunks: mergeTextChunks(newChunks),
    };
  }
}

type AssetFetchResult = {
  buffer: Buffer;
  mimeType: string;
};

// Fetch media asset from long term  storage in Drive.
async function fetchDriveAssetAsBuffer(
  driveId: string,
  oldMimetype: string,
  accessToken: string
): Promise<Outcome<AssetFetchResult>> {
  const driveClient = new GoogleDriveClient({
    fetchWithCreds: createFetchWithCreds(async () => accessToken),
  });
  let arrayBuffer;
  let mimeType = oldMimetype;
  if (oldMimetype.startsWith("application/vnd.google-apps.")) {
    switch (oldMimetype) {
      case "application/vnd.google-apps.document":
        mimeType = "text/markdown";
        break;
      case "application/vnd.google-apps.presentation":
        mimeType = "text/plain";
        break;
      case "application/vnd.google-apps.spreadsheet":
        mimeType = "text/csv";
        break;
      default:
        return err(
          `Unable to fetch drive asset "${driveId}": unsupported type "${mimeType}"`
        );
    }
    const exporting = await driveClient.exportFile(driveId, { mimeType });
    if (!exporting.ok) {
      return err(`Unable to export file "${driveId}"`);
    }
    arrayBuffer = await exporting.arrayBuffer();
  } else {
    const gettingMedia = await driveClient.getFileMedia(driveId);
    if (!gettingMedia.ok) {
      return err(`Unable to get media for file "${driveId}"`);
    }
    arrayBuffer = await gettingMedia.arrayBuffer();
  }
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

function mergeTextChunks(chunks: Chunk[]) {
  let textChunk: Chunk | undefined = undefined;
  const merged: Chunk[] = [];
  for (const chunk of chunks) {
    if (chunk.mimetype === "text/plain") {
      if (textChunk) {
        // Append to textChunk
        const text = `${toText(chunk.data)}\n${toText(chunk.data)}`;
        textChunk.data = toBase64(text);
      } else {
        textChunk = chunk;
        merged.push(textChunk);
      }
    } else {
      merged.push(chunk);
    }
  }
  return merged;

  function toText(base64: string) {
    return Buffer.from(base64, "base64").toString("utf-8");
  }

  function toBase64(s: string) {
    return Buffer.from(s, "utf-8").toString("base64");
  }
}
