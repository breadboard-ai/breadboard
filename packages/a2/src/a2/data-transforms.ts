/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isFileDataCapabilityPart } from "@breadboard-ai/data";
import {
  Chunk,
  DataPartTransformer,
  FileDataPart,
  InlineDataCapabilityPart,
  Outcome,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory";

export { createDataPartTansformer, driveFileToBlob, toGcsAwareChunk };

const BLOB_PREFIX = new URL("/board/blobs/", window.location.href).href;

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
  if (!(await shouldCallBackend(moduleArgs))) {
    return driveFileToGeminiFileOld(moduleArgs, part);
  }
  const driveFileId = part.fileData.fileUri.replace(/^drive:\/+/, "");
  const searchParams = new URLSearchParams();
  const { resourceKey, mimeType } = part.fileData;
  if (resourceKey) {
    searchParams.set("resourceKey", resourceKey);
  }
  if (mimeType) {
    searchParams.set("mimeType", mimeType);
  }

  const request: UploadGeminiFileRequest = { driveFileId };
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
  if (!(await shouldCallBackend(moduleArgs))) {
    return blobToGeminiFileOld(moduleArgs, blobId);
  }

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
  if (!(await shouldCallBackend(moduleArgs))) {
    return toBlobStoredDataOld(moduleArgs, part);
  }

  const existingHandle = part.storedData.handle;
  if (existingHandle.startsWith(BLOB_PREFIX)) {
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

function toGcsAwareChunk(
  bucketId: string,
  blobStoreData: BlobStoredData
): Chunk {
  const {
    part: {
      storedData: { handle },
    },
  } = blobStoreData;

  // pluck blobId out
  const blobId = handle.split("/").slice(-1)[0];
  const path = `${bucketId}/${blobId}`;

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

async function shouldCallBackend({ context }: A2ModuleArgs): Promise<boolean> {
  return !!(await context.flags?.flags())?.backendTransforms;
}

async function callBackend<Req, Res>(
  { fetchWithCreds, context }: A2ModuleArgs,
  request: Req,
  endpoint: string
): Promise<Outcome<Res>> {
  const backendApiEndpoint =
    context.clientDeploymentConfiguration?.BACKEND_API_ENDPOINT;
  if (!backendApiEndpoint) {
    return err(`Unable to transform: backend API endpoint not specified`);
  }
  const url = new URL(endpoint, backendApiEndpoint);

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
        const { handle, mimeType } = part.storedData;
        if (handle.startsWith(DRIVE_URL_PREFIX)) {
          return driveFileToGeminiFile(moduleArgs, {
            fileData: { fileUri: handle, mimeType },
          });
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

/** Old transforms */

async function driveFileToGeminiFileOld(
  moduleArgs: A2ModuleArgs,
  part: FileDataPart
): Promise<Outcome<FileDataPart>> {
  const { fetchWithCreds, context } = moduleArgs;

  const fileId = part.fileData.fileUri.replace(/^drive:\/+/, "");
  try {
    const searchParams = new URLSearchParams();
    const { resourceKey, mimeType } = part.fileData;
    if (resourceKey) {
      searchParams.set("resourceKey", resourceKey);
    }
    if (mimeType) {
      searchParams.set("mimeType", mimeType);
    }
    // TODO: Un-hardcode the path and get rid of the "@foo/bar".
    const path = `/board/boards/@foo/bar/assets/drive/${fileId}?${searchParams}`;
    const converting = await fetchWithCreds(
      new URL(path, window.location.origin),
      {
        method: "POST",
        body: JSON.stringify({ part }),
        signal: context.signal,
      }
    );
    if (!converting.ok) return err(decodeError(await converting.text()));

    const converted =
      (await converting.json()) as Outcome<GoogleDriveToGeminiResponse>;
    if (!ok(converted)) return converted;

    return converted.part;
  } catch (e) {
    return err((e as Error).message);
  }
}

async function blobToGeminiFileOld(
  { fetchWithCreds, context }: A2ModuleArgs,
  blobId: string
): Promise<Outcome<FileDataPart>> {
  try {
    const path = `/api/data/transform/blob/${blobId}`;
    const converting = await fetchWithCreds(
      new URL(path, window.location.origin),
      {
        method: "POST",
        credentials: "include",
        signal: context.signal,
      }
    );
    const converted =
      (await converting.json()) as Outcome<GoogleDriveToGeminiResponse>;
    if (!ok(converted)) return converted;
    return converted.part;
  } catch (e) {
    return err((e as Error).message);
  }
}

async function toBlobStoredDataOld(
  { fetchWithCreds }: A2ModuleArgs,
  part: StoredDataCapabilityPart
): Promise<Outcome<BlobStoredData>> {
  const handle = part.storedData.handle;
  if (handle.startsWith(BLOB_PREFIX)) {
    return { part };
  } else if (!handle.startsWith("drive:/")) {
    return err(`Unknown blob URL: "${handle}`);
  }
  const driveId = handle.replace("drive:/", "");
  const {
    storedData: { mimeType, resourceKey },
  } = part;
  const query = new URLSearchParams();
  query.append("mode", "blob");
  query.append("mimeType", mimeType);
  if (resourceKey) {
    query.append("resourceKey", resourceKey);
  }

  try {
    const blobifying = await fetchWithCreds(
      new URL(
        `/board/boards/@foo/bar/assets/drive/${driveId}?${query}`,
        window.location.href
      ),
      { method: "POST" }
    );
    if (!blobifying.ok) {
      return err(`Failed to convert Drive file to Blob`);
    }
    return blobifying.json();
  } catch (e) {
    return err(`Failed to convert Drive file to Blob: ${(e as Error).message}`);
  }
}
