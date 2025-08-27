/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataPart,
  HarnessRunResult,
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { Storage, type FileMetadata } from "@google-cloud/storage";
import {
  err,
  ok,
  type DataStore,
  type DataStoreScope,
  type Outcome,
  type RetrieveDataResult,
  type Schema,
  type SerializedDataStoreGroup,
  type StoreDataResult,
} from "@google-labs/breadboard";
import { Readable } from "node:stream";
import type { BlobStore, BlobStoreGetResult, Result } from "./types.js";

export { BlobDataStore, GoogleStorageBlobStore, isUUID };

export type FileAPIMetadata = {
  fileUri?: string;
  expirationTime?: string;
};

class GoogleStorageBlobStore implements BlobStore {
  #storage: Storage;
  #bucketId: string;
  #serverUrl: string | undefined;

  constructor(bucketId: string, serverUrl?: string) {
    this.#storage = new Storage();
    this.#bucketId = bucketId;
    this.#serverUrl = serverUrl;
  }

  async getMetadata(blobId: string): Promise<Outcome<FileMetadata>> {
    try {
      const [metadata] = await this.#storage
        .bucket(this.#bucketId)
        .file(blobId)
        .getMetadata();
      return metadata || {};
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async setMetadata(
    blobId: string,
    metadata: FileAPIMetadata
  ): Promise<Outcome<void>> {
    await this.#storage
      .bucket(this.#bucketId)
      .file(blobId)
      .setMetadata({ metadata });
  }

  async getReadableStream(blobId: string): Promise<Readable> {
    return this.#storage.bucket(this.#bucketId).file(blobId).createReadStream();
  }

  async deflateContent(content: LLMContent): Promise<Outcome<LLMContent>> {
    const { parts, role } = content as LLMContent;
    const replacedParts: DataPart[] = [];
    for (const part of parts) {
      if ("inlineData" in part) {
        const result = await this.saveData(part);
        if (!ok(result)) {
          return result;
        }
        replacedParts.push(result);
      } else {
        replacedParts.push(part);
      }
    }
    return { parts: replacedParts, role };
  }

  async saveData(
    data: InlineDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    if (!this.#serverUrl) {
      return err("Server URL is not set");
    }

    const buffer = Buffer.from(data.inlineData.data, "base64");
    const contentType = data.inlineData.mimeType;
    const saveResult = await this.saveBuffer(buffer, contentType);
    if (!ok(saveResult)) {
      return saveResult;
    }
    const uuid = saveResult;
    return toStoredData(uuid, this.#serverUrl, contentType);
  }

  async saveBuffer(
    buffer: Buffer,
    contentType: string
  ): Promise<Outcome<string>> {
    try {
      const uuid = crypto.randomUUID();

      const bucket = this.#storage.bucket(this.#bucketId);
      const file = bucket.file(uuid);
      await file.save(buffer, { contentType });

      return uuid;
    } catch (e) {
      return err((e as Error).message);
    }
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

class BlobDataStore implements DataStore {
  #blobStore: BlobStore;
  #serverOrigin: string;

  constructor(blobStore: BlobStore, serverOrigin: string) {
    this.#blobStore = blobStore;
    this.#serverOrigin = serverOrigin;
  }

  createGroup(_groupId: string): void {
    // no op.
  }

  drop(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  has(_groupId: string): boolean {
    throw new Error("Method not implemented.");
  }

  releaseAll(): void {
    // no op.
  }

  releaseGroup(_group: string): void {
    // no op.
  }
  replaceDataParts(_key: string, _result: HarnessRunResult): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async retrieveAsBlob(part: StoredDataCapabilityPart): Promise<Blob> {
    const { handle } = part.storedData;
    const getHandleResult = idFromHandle(handle, this.#serverOrigin);
    if (!getHandleResult.success) {
      throw new Error(getHandleResult.error);
    }
    const getBlobResult = await this.#blobStore.getBlob(getHandleResult.result);
    if (!ok(getBlobResult)) {
      throw new Error(getBlobResult.$error);
    }
    const { data, mimeType: type } = getBlobResult;
    return new Blob([data as BlobPart], { type });
  }

  serializeGroup(
    _group: string,
    _storeId?: string
  ): Promise<SerializedDataStoreGroup | null> {
    throw new Error("Method not implemented.");
  }

  async store(blob: Blob): Promise<StoredDataCapabilityPart> {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const contentType = blob.type;
    const result = await this.#blobStore.saveBuffer(buffer, contentType);
    if (!ok(result)) {
      throw new Error(result.$error);
    }
    return toStoredData(result, this.#serverOrigin, contentType);
  }

  storeData(
    _key: string,
    _value: object | null,
    _schema: Schema,
    _scope: DataStoreScope
  ): Promise<StoreDataResult> {
    throw new Error("Method not implemented.");
  }

  retrieveData(_key: string): Promise<RetrieveDataResult> {
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
  // TODO: Remove hard-coded `/board/` here and use serverUrl, rather than
  // serverOrigin
  return `${serverUrl}/board/blobs/${handle}`;
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
