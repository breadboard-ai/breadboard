/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type FunctionCallCapabilityPart = {
  functionCall: {
    name: string;
    args: object;
  };
};

export type FunctionResponseCapabilityPart = {
  functionResponse: {
    name: string;
    response: object;
  };
};

export type TextCapabilityPart = {
  text: string;
};

export type DataPart =
  | InlineDataCapabilityPart
  | StoredDataCapabilityPart
  | FunctionCallCapabilityPart
  | FunctionResponseCapabilityPart
  | TextCapabilityPart;

export type LLMContent = {
  role?: string;
  parts: DataPart[];
};

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

export type SerializedStoredData = {
  handle: DataStoreHandle;
} & InlineDataCapabilityPart;

export type SerializedDataStoreGroup = SerializedStoredData[];

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
  startGroup(): void;
  endGroup(): number;
  releaseGroup(group: number): void;
  releaseAll(): void;
  serializeGroup(group: number): Promise<SerializedDataStoreGroup | null>;
  retrieveAsURL(storedData: StoredDataCapabilityPart): Promise<string>;
  copyToNewestGroup(
    storedData: StoredDataCapabilityPart
  ): Promise<StoredDataCapabilityPart>;
};
