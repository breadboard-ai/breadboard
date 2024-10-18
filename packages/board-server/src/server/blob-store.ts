/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";

import { Storage } from "@google-cloud/storage";
import type {
  BlobStore,
  BlobStoreGetResult,
  BlobStoreSaveResult,
  Result,
} from "./types.js";
import type {
  DataStore,
  DataStoreScope,
  RetrieveDataResult,
  Schema,
  SerializedDataStoreGroup,
  StoreDataResult,
} from "@google-labs/breadboard";
import type { HarnessRunResult } from "@google-labs/breadboard/harness";

export { GoogleStorageBlobStore, isUUID };

class GoogleStorageBlobStore implements BlobStore {
  #storage: Storage;
  #bucketId: string;
  #serverUrl: string | undefined;

  constructor(bucketId: string, serverUrl?: string) {
    this.#storage = new Storage();
    this.#bucketId = bucketId;
    this.#serverUrl = serverUrl;
  }

  async saveData(data: InlineDataCapabilityPart): Promise<BlobStoreSaveResult> {
    if (!this.#serverUrl) {
      return {
        success: false,
        error: "Server URL is not set",
      };
    }

    const buffer = Buffer.from(data.inlineData.data, "base64");
    const contentType = data.inlineData.mimeType;
    const saveResult = await this.saveBuffer(buffer, contentType);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }
    const uuid = saveResult.result;
    return {
      success: true,
      data: toStoredData(uuid, this.#serverUrl, contentType),
    };
  }

  async saveBuffer(
    buffer: Buffer,
    contentType: string
  ): Promise<Result<string>> {
    try {
      const uuid = crypto.randomUUID();

      const bucket = this.#storage.bucket(this.#bucketId);
      const file = bucket.file(uuid);
      await file.save(buffer, { contentType });

      return { success: true, result: uuid };
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

class BlobDataStore implements DataStore {
  #blobStore: BlobStore;
  #serverOrigin: string;

  constructor(blobStore: BlobStore, serverOrigin: string) {
    this.#blobStore = blobStore;
    this.#serverOrigin = serverOrigin;
  }

  createGroup(groupId: string): void {
    // no op.
  }

  drop(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  has(groupId: string): boolean {
    throw new Error("Method not implemented.");
  }

  releaseAll(): void {
    // no op.
  }

  releaseGroup(group: string): void {
    // no op.
  }
  replaceDataParts(key: string, result: HarnessRunResult): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async retrieveAsBlob(part: StoredDataCapabilityPart): Promise<Blob> {
    const { handle } = part.storedData;
    const getHandleResult = idFromHandle(handle, this.#serverOrigin);
    if (!getHandleResult.success) {
      throw new Error(getHandleResult.error);
    }
    const getBlobResult = await this.#blobStore.getBlob(getHandleResult.result);
    if (!getBlobResult.success) {
      throw new Error(getBlobResult.error);
    }
    const { data, mimeType: type } = getBlobResult;
    return new Blob([data], { type });
  }

  serializeGroup(
    group: string,
    storeId?: string
  ): Promise<SerializedDataStoreGroup | null> {
    throw new Error("Method not implemented.");
  }

  async store(blob: Blob): Promise<StoredDataCapabilityPart> {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const contentType = blob.type;
    const result = await this.#blobStore.saveBuffer(buffer, contentType);
    if (!result.success) {
      throw new Error(result.error);
    }
    return toStoredData(result.result, this.#serverOrigin, contentType);
  }

  storeData(
    key: string,
    value: object | null,
    schema: Schema,
    scope: DataStoreScope
  ): Promise<StoreDataResult> {
    throw new Error("Method not implemented.");
  }

  retrieveData(key: string): Promise<RetrieveDataResult> {
    throw new Error("Method not implemented.");
  }
}

function error<T>(message: string): Result<T> {
  return { success: false, error: message };
}

function idFromHandle(handle: string, origin: string): Result<string> {
  try {
    const handleUrl = new URL(handle);
    if (handleUrl.origin !== origin) {
      return error(`Invalid origin in handle "${handle}".`);
    }
    // TODO: Unify with the code in src/blobs/index.ts
    const [api, blob] = handleUrl.pathname.split("/").slice(1);
    if (api !== "blobs") {
      return error(`Invalid blobs access path in handle "${handle}".`);
    }
    if (!blob || !isUUID(blob)) {
      return error(`Invalid handle "${handle}".`);
    }
    return { success: true, result: blob };
  } catch (e) {
    return {
      success: false,
      error: `Stored data handle "${handle}" is not a valid URL`,
    };
  }
}

function isUUID(blob: string) {
  return (
    blob &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(blob)
  );
}

function makeBlobUrl(handle: string, serverUrl: string): string {
  return `${serverUrl}/blobs/${handle}`;
}

function toStoredData(
  uuid: string,
  serverUrl: string,
  mimeType: string
): StoredDataCapabilityPart {
  return {
    storedData: { handle: makeBlobUrl(uuid, serverUrl), mimeType },
  };
}
