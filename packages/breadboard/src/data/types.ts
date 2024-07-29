/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";

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

export type RunStore = {
  start(storeId: string, limit?: number): Promise<string>;
  write(result: HarnessRunResult): Promise<void>;
  stop(): Promise<void>;
  abort(): Promise<void>;
  drop(): Promise<void>;
  getNewestRuns(limit: number): Promise<HarnessRunResult[][]>;
};

export type DataStore = {
  has(groupId: string): boolean;
  replaceDataParts(key: string, result: HarnessRunResult): Promise<void>;
  serializeGroup(group: string): Promise<SerializedDataStoreGroup | null>;
  releaseGroup(group: string): void;
  releaseAll(): void;
  drop(): Promise<void>;
};
