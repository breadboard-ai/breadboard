/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Represents inline data, encoded as a base64 string.
 */
export type InlineDataCapabilityPart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

/**
 * Represents data that is stored by a DataStoreProvider.
 */
export type StoredDataCapabilityPart = {
  storedData: {
    handle: DataStoreHandle;
    mimeType: string;
  };
};

export type DataStoreHandle = string;

export type StoredData = {
  asInline(): Promise<InlineDataCapabilityPart>;
};

/**
 * A provider that handles storing and retrieving data.
 */
export type DataStoreProvider = {
  store(data: InlineDataCapabilityPart): Promise<StoredData>;
  retrieve(handle: DataStoreHandle): Promise<StoredData>;
  release(handle: DataStoreHandle): Promise<void>;
  releaseAll(): Promise<void>;
};

export type DataStore = {
  store(data: Blob): Promise<StoredDataCapabilityPart>;
  retrieve(
    storedData: StoredDataCapabilityPart
  ): Promise<InlineDataCapabilityPart>;
  retrieveAsBlob(storedData: StoredDataCapabilityPart): Promise<Blob>;
  retrieveAsURL(storedData: StoredDataCapabilityPart): Promise<string>;
};
