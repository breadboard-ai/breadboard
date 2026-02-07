/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OPAL_BACKEND_API_PREFIX,
  Chunk,
  DataPartTransformer,
  FileDataPart,
  InlineDataCapabilityPart,
  Outcome,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { err, ok, isNotebookLmUrl } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { isFileDataCapabilityPart } from "../../data/common.js";

export { createDataPartTansformer, driveFileToBlob, toGcsAwareChunk };

function getBlobPrefix(): string {
  return new URL("/board/blobs/", window.location.href).href;
}

const BACKEND_UPLOAD_BLOB_FILE_ENDPOINT = "/v1beta1/uploadBlobFile";

type BackendError = {
  error: {
    code: number;
    message: string;
    status: string;
  };
};

export type BlobStoredData = {
  part: StoredDataCapabilityPart;
};

export type UploadBlobFileRequest = {
  driveFileId: string;
};

export type UploadBlobFileResponse = {
  blobId: string;
  mimeType: string;
};

export type GoogleDriveToGeminiResponse = {
  part: FileDataPart;
};

export type UploadGeminiFileRequest =
  | {
      driveFileId: string;
      driveResourceKey?: string;
    }
  | { blobId: string };

export type UploadGeminiFileResponse = {
  fileUrl: string;
  mimeType: string;
};

const DRIVE_URL_PREFIX = "drive:";

const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/";

const GEMINI_FILE_API_URL = `${GEMINI_API_ENDPOINT}/files/`;

const BACKEND_UPLOAD_GEMINI_FILE_ENDPOINT = "/v1beta1/uploadGeminiFile";

function maybeBlob(handle: string): string | false {
  const handleParts = handle.split("/");
  const blob = handleParts.pop();
  const api = handleParts.join("/");
  if (!api.startsWith(window.location.origin) || !api.endsWith("/blobs")) {
    return false;
  }
  return blob &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(blob)
    ? blob
    : false;
}

/**
 * The D2F transform.
 */
async function driveFileToGeminiFile(
  moduleArgs: A2ModuleArgs,
  part: FileDataPart
): Promise<Outcome<FileDataPart>> {
  const driveFileId = part.fileData.fileUri.replace(/^drive:\/+/, "");
  const { resourceKey } = part.fileData;
  const request: UploadGeminiFileRequest = { driveFileId };
  if (resourceKey) {
    request.driveResourceKey = resourceKey;
  }
  const response: Outcome<UploadGeminiFileResponse> = await callBackend(
    moduleArgs,
    request,
    BACKEND_UPLOAD_GEMINI_FILE_ENDPOINT
  );
  if (!ok(response)) return response;

  return {
    fileData: {
      fileUri: new URL(response.fileUrl, GEMINI_API_ENDPOINT).href,
      mimeType: response.mimeType,
    },
  } as FileDataPart;
}

/**
 * The B2F transform.
 */
async function blobToGeminiFile(
  moduleArgs: A2ModuleArgs,
  blobId: string
): Promise<Outcome<FileDataPart>> {
  const request: UploadGeminiFileRequest = { blobId };
  const response: Outcome<UploadGeminiFileResponse> = await callBackend(
    moduleArgs,
    request,
    BACKEND_UPLOAD_GEMINI_FILE_ENDPOINT
  );
  if (!ok(response)) return response;

  return {
    fileData: {
      fileUri: new URL(response.fileUrl, GEMINI_API_ENDPOINT).href,
      mimeType: response.mimeType,
    },
  };
}

/**
 * The D2B transform.
 */
async function driveFileToBlob(
  moduleArgs: A2ModuleArgs,
  part: StoredDataCapabilityPart
): Promise<Outcome<BlobStoredData>> {
  const existingHandle = part.storedData.handle;
  if (existingHandle.startsWith(getBlobPrefix())) {
    return { part };
  } else if (isNotebookLmUrl(existingHandle)) {
    // NotebookLM references pass through as-is - no blob conversion needed
    return { part };
  } else if (!existingHandle.startsWith("drive:/")) {
    return err(`Unknown blob URL: "${existingHandle}`);
  }

  const driveFileId = existingHandle.replace("drive:/", "");
  const request: UploadBlobFileRequest = { driveFileId };
  const response: Outcome<UploadBlobFileResponse> = await callBackend(
    moduleArgs,
    request,
    BACKEND_UPLOAD_BLOB_FILE_ENDPOINT
  );
  if (!ok(response)) return response;

  const handle = new URL(
    `/board/blobs/${response.blobId}`,
    window.location.href
  ).href;
  return { part: { storedData: { handle, mimeType: response.mimeType } } };
}

function toGcsAwareChunk(blobStoreData: BlobStoredData): Chunk {
  const {
    part: {
      storedData: { handle },
    },
  } = blobStoreData;

  // pluck blobId out
  const blobId = handle.split("/").slice(-1)[0];
  const path = blobId;

  const data = btoa(String.fromCodePoint(...new TextEncoder().encode(path)));
  return { data, mimetype: "text/gcs-path" };
}

function decodeError(s: string) {
  try {
    const json = JSON.parse(s) as BackendError;
    return json?.error?.message || "Unknown error";
  } catch {
    return "Unknown error";
  }
}

async function callBackend<Req, Res>(
  { fetchWithCreds, context }: A2ModuleArgs,
  request: Req,
  endpoint: string
): Promise<Outcome<Res>> {
  const url = new URL(endpoint, OPAL_BACKEND_API_PREFIX);

  try {
    const fetching = await fetchWithCreds(url, {
      method: "POST",
      body: JSON.stringify(request),
      signal: context.signal,
    });
    if (!fetching.ok) return err(decodeError(await fetching.text()));
    const response = (await fetching.json()) as Outcome<Res>;
    return response;
  } catch (e) {
    return err((e as Error).message);
  }
}

function createDataPartTansformer(
  moduleArgs: A2ModuleArgs
): DataPartTransformer {
  return {
    persistPart: async function (
      _graphUrl: URL,
      _part: InlineDataCapabilityPart | StoredDataCapabilityPart,
      _temporary: boolean
    ): Promise<Outcome<StoredDataCapabilityPart>> {
      const msg = `Persisting parts is not supported`;
      console.error(msg);
      return err(msg);
    },
    addEphemeralBlob: function (_blob: Blob): StoredDataCapabilityPart {
      throw new Error(`Adding Ephemeral blob is not supported`);
    },
    persistentToEphemeral: async function (
      _part: StoredDataCapabilityPart
    ): Promise<Outcome<StoredDataCapabilityPart>> {
      const msg = `Converting persistent blobs to ephemeral is not supported`;
      console.error(msg);
      return err(msg);
    },
    toFileData: async function (
      _graphUrl: URL,
      part: StoredDataCapabilityPart | FileDataPart
    ): Promise<Outcome<FileDataPart>> {
      if (isFileDataCapabilityPart(part)) {
        const { fileUri, mimeType } = part.fileData;
        // part is FileDataPart
        if (fileUri.startsWith(GEMINI_FILE_API_URL)) {
          return part;
        } else if (mimeType === "video/mp4") {
          // YouTube video
          return part;
        } else if (fileUri.startsWith(DRIVE_URL_PREFIX)) {
          console.warn(`This should never happen anymore`, part);
          return driveFileToGeminiFile(moduleArgs, part);
        }
      } else {
        // part is StoredDataCapabilityPart
        const { handle, mimeType, resourceKey } = part.storedData;
        if (handle.startsWith(DRIVE_URL_PREFIX)) {
          return driveFileToGeminiFile(moduleArgs, {
            fileData: { fileUri: handle, mimeType, resourceKey },
          });
        } else if (isNotebookLmUrl(handle)) {
          // NotebookLM references are metadata, not convertible to file data
          // They should be handled by generate steps that understand NotebookLM URLs
          return err(
            `NotebookLM references cannot be converted to file data. ` +
              `They should be used with generate steps that support NotebookLM context.`
          );
        } else {
          // check to see if it's a blob
          const blobId = maybeBlob(handle);
          if (blobId) {
            return blobToGeminiFile(moduleArgs, blobId);
          }
        }
      }
      return err(`Unknown part "${JSON.stringify(part)}"`);
    },
  };
}
