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
import { GeminiFileApi } from "./gemini-file-api.js";

export { GoogleDriveDataPartTransformer };

class GoogleDriveDataPartTransformer implements DataPartTransformer {
  constructor(public readonly client: GoogleDriveClient) {}

  async persistPart(
    _graphUrl: URL,
    _part: InlineDataCapabilityPart,
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
      // This is is most likely the situation when a new BGL asset is saved
      // and being persisted.
      const msg = `Persisting assets is not supported with Google Drive backend`;
      console.debug(msg);
      return err(msg);
    }
  }

  async toFileData(
    _graphUrl: URL,
    part: StoredDataCapabilityPart | FileDataPart
  ): Promise<Outcome<FileDataPart>> {
    // Called by ProxyClient.proxy to ensure that parts are correctly turned
    // into handles that Gemini API can understand.
    // There are two kinds:
    // 1) FileDataPart that is a Drive File. These need to be first exported
    //    as PDF, then uploaded using Gemini File API to get the right fileUri.
    // 2) StoredDataCapabilityPart. These need to be uploaded using
    //    Gemini File API to create the right FileDataPart.
    if (isFileDataCapabilityPart(part)) {
      if (isGoogleDriveDocument(part)) {
        const fileId = part.fileData.fileUri;
        // 1) Export the file as PDF
        const exported = await this.client.exportFile(fileId);
        // 2) Pipe it through to file API
        const fileApi = new GeminiFileApi(await this.client.accessToken());
        const uploading = await fileApi.upload(
          exported,
          fileId,
          "application/pdf"
        );
        if (!ok(uploading)) return uploading;
      }
    }
    const msg = `Converting to FileData is not supported with Google Drive backend`;
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
