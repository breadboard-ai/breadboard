/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InlineDataCapabilityPart } from "@breadboard-ai/types";

import { Storage } from "@google-cloud/storage";
import type {
  BlobStore,
  BlobStoreGetResult,
  BlobStoreSaveResult,
} from "../../types.js";

export { GoogleStorageBlobStore };

class GoogleStorageBlobStore implements BlobStore {
  #storage: Storage;
  #bucketId: string;
  #serverUrl: string | undefined;

  constructor(bucketId: string, serverUrl?: string) {
    this.#storage = new Storage();
    this.#bucketId = bucketId;
    this.#serverUrl = serverUrl;
  }

  #makeBlobUrl(handle: string): string {
    return `${this.#serverUrl}/blobs/${handle}`;
  }

  async saveBlob(data: InlineDataCapabilityPart): Promise<BlobStoreSaveResult> {
    if (!this.#serverUrl) {
      return {
        success: false,
        error: "Server URL is not set",
      };
    }

    try {
      const buffer = Buffer.from(data.inlineData.data, "base64");

      const uuid = crypto.randomUUID();

      const bucket = this.#storage.bucket(this.#bucketId);
      const file = bucket.file(uuid);
      const contentType = data.inlineData.mimeType;
      await file.save(buffer, { contentType });

      return {
        success: true,
        data: {
          storedData: {
            handle: this.#makeBlobUrl(uuid),
            mimeType: contentType,
          },
        },
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }

  async getBlob(handle: string): Promise<BlobStoreGetResult> {
    try {
      const bucket = this.#storage.bucket(this.#bucketId);
      const file = bucket.file(handle);
      const [metadata] = await file.getMetadata();
      const [data] = await file.download();

      return {
        success: true,
        data,
        mimeType: metadata.contentType,
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }
}
