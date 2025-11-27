/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Storage } from "@google-cloud/storage";
import type { BlobStore, BlobStoreGetResult } from "./types.js";
import type { Outcome } from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";

export { GoogleStorageBlobStore, isUUID };

class GoogleStorageBlobStore implements BlobStore {
  #storage: Storage;
  #bucketId: string;

  constructor(bucketId: string) {
    this.#storage = new Storage();
    this.#bucketId = bucketId;
  }

  async getBlob(handle: string): Promise<Outcome<BlobStoreGetResult>> {
    try {
      const bucket = this.#storage.bucket(this.#bucketId);
      const file = bucket.file(handle);
      const [metadata] = await file.getMetadata();
      const [data] = await file.download();

      return {
        data,
        mimeType: metadata.contentType,
      };
    } catch (e) {
      return err((e as Error).message);
    }
  }
}

function isUUID(blob: string) {
  return (
    blob &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(blob)
  );
}
