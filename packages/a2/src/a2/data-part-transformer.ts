/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isFileDataCapabilityPart } from "@breadboard-ai/data";
import {
  DataPartTransformer,
  FileDataPart,
  InlineDataCapabilityPart,
  Outcome,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";

export { createDataPartTansformer };

export type GoogleDriveToGeminiResponse = {
  part: FileDataPart;
};

const GEMINI_FILE_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/files/";

function isGoogleDriveDocument(part: FileDataPart) {
  return part.fileData.mimeType.startsWith("application/vnd.google-apps.");
}

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

async function driveFileToGeminiFile(
  { fetchWithCreds }: A2ModuleFactoryArgs,
  part: FileDataPart
): Promise<Outcome<FileDataPart>> {
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
    const converting = await fetchWithCreds(path, {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ part }),
    });
    if (!converting.ok) return err(await converting.text());

    const converted =
      (await converting.json()) as Outcome<GoogleDriveToGeminiResponse>;
    if (!ok(converted)) return converted;

    return converted.part;
  } catch (e) {
    return err((e as Error).message);
  }
}

async function blobToGeminiFile(
  { fetchWithCreds }: A2ModuleFactoryArgs,
  blobId: string
): Promise<Outcome<FileDataPart>> {
  try {
    const path = `/api/data/transform/blob/${blobId}`;
    const converting = await fetchWithCreds(path, {
      method: "POST",
      credentials: "include",
    });
    const converted =
      (await converting.json()) as Outcome<GoogleDriveToGeminiResponse>;
    if (!ok(converted)) return converted;
    return converted.part;
  } catch (e) {
    return err((e as Error).message);
  }
}

function createDataPartTansformer(
  moduleArgs: A2ModuleFactoryArgs
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
        const { fileUri } = part.fileData;
        // part is FileDataPart
        if (fileUri.startsWith(GEMINI_FILE_API_URL)) {
          return part;
        } else if (isGoogleDriveDocument(part)) {
          // A document, like
          return driveFileToGeminiFile(moduleArgs, part);
        }
      } else {
        // part is StoredDataCapabilityPart
        const { handle, mimeType } = part.storedData;
        if (handle.startsWith("drive:")) {
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
