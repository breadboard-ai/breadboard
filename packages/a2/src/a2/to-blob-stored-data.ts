/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chunk, Outcome, StoredDataCapabilityPart } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory";
import { getBucketId } from "./get-bucket-id";

export { toBlobStoredData, toGcsAwareChunk };

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

export type UploadBlobFileResponse = {
  gcsUri: string;
  mimeType: string;
};

async function toBlobStoredData(
  moduleArgs: A2ModuleArgs,
  part: StoredDataCapabilityPart
): Promise<Outcome<BlobStoredData>> {
  const { fetchWithCreds, context } = moduleArgs;

  const enableBackendTransforms = !!(await context.flags?.flags())
    ?.backendTransforms;
  if (!enableBackendTransforms) {
    return toBlobStoredDataOld(moduleArgs, part);
  }
  const backendApiEndpoint =
    context.clientDeploymentConfiguration?.BACKEND_API_ENDPOINT;
  if (!backendApiEndpoint) {
    return err(`Unable to transform: backend API endpoint not specified`);
  }
  const url = new URL(BACKEND_UPLOAD_BLOB_FILE_ENDPOINT, backendApiEndpoint);

  const existingHandle = part.storedData.handle;
  if (existingHandle.startsWith(BLOB_PREFIX)) {
    return { part };
  } else if (!existingHandle.startsWith("drive:/")) {
    return err(`Unknown blob URL: "${existingHandle}`);
  }
  const driveFileId = existingHandle.replace("drive:/", "");
  const bucketName = await getBucketId(moduleArgs);
  try {
    const blobifying = await fetchWithCreds(url, {
      method: "POST",
      body: JSON.stringify({
        driveFileId,
        gcsConfig: {
          bucketName,
        },
      }),
      signal: context.signal,
    });
    if (!blobifying.ok) return err(decodeError(await blobifying.text()));
    const blobified =
      (await blobifying.json()) as Outcome<UploadBlobFileResponse>;
    if (!ok(blobified)) return blobified;
    const handle = new URL(
      `/board/blobs/${blobified.gcsUri.split("/")[1]}`,
      window.location.href
    ).href;
    return { part: { storedData: { handle, mimeType: blobified.mimeType } } };
  } catch (e) {
    return err(`Failed to convert Drive file to Blob: ${(e as Error).message}`);
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
