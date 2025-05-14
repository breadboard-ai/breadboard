/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FileDataPart,
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import {
  err,
  isFileDataCapabilityPart,
  ok,
  type DataPartTransformer,
  type Outcome,
} from "@google-labs/breadboard";
import type { GoogleDriveClient } from "../google-drive-client.js";
import type { DriveOperations } from "./operations.js";

export { GoogleDriveDataPartTransformer };

export type GoogleDriveToGeminiResponse = {
  part: FileDataPart;
};

class GoogleDriveDataPartTransformer implements DataPartTransformer {
  constructor(
    public readonly client: GoogleDriveClient,
    private readonly ops: DriveOperations
  ) {}

  async #createRequest(path: string, body: unknown): Promise<Request> {
    return new Request(path, {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${await this.client.accessToken()}`,
      },
      body: JSON.stringify(body),
    });
  }

  async persistPart(
    _graphUrl: URL,
    part: InlineDataCapabilityPart,
    temporary: boolean
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    if (temporary) {
      // This is most likely the situation when `blob` capability is called
      // from jsandbox to convert a part into storedData with a temporary url.
      // Use case: creating publicly accessible URls for adding images to
      // documents/slides.
      const msg = `Persisting temporary blobs is not supported with Google Drive backend`;
      console.debug(msg);
      return err(msg);
    } else {
      const driveFileUrl = await this.ops.saveDataPart(
        part.inlineData.data,
        part.inlineData.mimeType,
      );
      return {
        storedData: {
          handle: driveFileUrl,
          mimeType: part.inlineData.mimeType,
        },
      };
    }
  }

  async toFileData(
    _graphUrl: URL,
    part: StoredDataCapabilityPart | FileDataPart
  ): Promise<Outcome<FileDataPart>> {
    let mimeType;
    // Called by ProxyClient.proxy to ensure that parts are correctly turned
    // into handles that Gemini API can understand.
    // There are two kinds:
    // 1) FileDataPart that is a Drive File. These need to be first exported
    //    as PDF, then uploaded using Gemini File API to get the right fileUri.
    // 2) StoredDataCapabilityPart. These need to be uploaded using
    //    Gemini File API to create the right FileDataPart.
    if (isFileDataCapabilityPart(part)) {
      mimeType = part.fileData.mimeType;
      if (isGoogleDriveDocument(part)) {
        const fileId = part.fileData.fileUri;
        // TODO: Un-hardcode the path and get rid of the "@foo/bar".
        const path = `/board/boards/@foo/bar/assets/drive/${fileId}`;
        const converting = await fetch(
          await this.#createRequest(path, { part })
        );
        if (!converting.ok) return err(await converting.text());

        const converted =
          (await converting.json()) as Outcome<GoogleDriveToGeminiResponse>;
        if (!ok(converted)) return converted;

        return converted.part;
      }
    } else {
      mimeType = part.storedData.mimeType;
    }
    const msg = `Converting to FileData of type "${mimeType}" is not supported with Google Drive backend`;
    console.debug(msg);
    return err(msg);
  }

  async persistentToEphemeral(
    _part: StoredDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    const msg = `Converting persistent blobs to ephemeral is not supported with Google Drive backend`;
    console.debug(msg);
    return err(msg);
  }

  addEphemeralBlob(_blob: Blob): StoredDataCapabilityPart {
    throw new Error("Not implemented");
  }
}

function isGoogleDriveDocument(part: FileDataPart) {
  return part.fileData.mimeType.startsWith("application/vnd.google-apps.");
}
