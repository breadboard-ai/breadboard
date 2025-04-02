/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataPartTransformer,
  err,
  isStoredData,
  Outcome,
} from "@google-labs/breadboard";
import {
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
  FileDataPart,
  LLMContent,
} from "../../schema/dist/graph";

export { FileSystemDataPartTransformer };

class FileSystemDataPartTransformer implements DataPartTransformer {
  async persistPart(
    _graphUrl: URL,
    part: InlineDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    const temporaryBlobStoreURL = import.meta.env.VITE_TEMPORARY_BLOB_STORE_URL;
    if (!temporaryBlobStoreURL) {
      return err(
        `Can't persist: set "VITE_TEMPORARY_BLOB_STORE_URL" env variable`
      );
    }
    // TODO: Make this configurable
    const request = new Request(temporaryBlobStoreURL, {
      method: "POST",
      body: JSON.stringify({ parts: [part] }),
    });
    try {
      const response = await fetch(request);
      if (!response.ok) {
        const error = await request.text();
        return err(`Persisting part failed: ${error}`);
      }

      const body = (await response.json()) as LLMContent;
      const part = body.parts.at(0);
      if (!part || !isStoredData(part)) {
        return err(`No part found in response`);
      }
      return part;
    } catch (e) {
      return err(`Persiting part failed: ${(e as Error).message}`);
    }
  }

  addEphemeralBlob(_blob: Blob): StoredDataCapabilityPart {
    throw new Error(`Not implemented`);
  }

  async persistentToEphemeral(
    _part: StoredDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    return err(`Not implemented`);
  }

  async toFileData(
    _graphUrl: URL,
    _part: StoredDataCapabilityPart | FileDataPart
  ): Promise<Outcome<FileDataPart>> {
    return err(`Not implemented`);
  }
}
