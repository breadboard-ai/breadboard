/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import { ReanimationState } from "../run/types.js";

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

export type RunURL = string;
export type RunTimestamp = number;

export type DataStoreProvider = {
  store(data: InlineDataCapabilityPart): Promise<StoredData>;
  retrieve(handle: DataStoreHandle): Promise<StoredData>;
  release(handle: DataStoreHandle): Promise<void>;
  releaseAll(): Promise<void>;
};

export type RunStore = {
  start(url: RunURL): Promise<RunTimestamp>;
  write(
    url: RunURL,
    timestamp: RunTimestamp,
    result: HarnessRunResult
  ): Promise<void>;
  stop(url: RunURL, timestamp: RunTimestamp): Promise<void>;
  abort(url: RunURL, timestamp: RunTimestamp): Promise<void>;
  drop(url?: RunURL): Promise<void>;
  truncate(url: RunURL, limit: number): Promise<void>;
  getStoredRuns(url: RunURL): Promise<Map<RunTimestamp, HarnessRunResult[]>>;
};

export type DataStore = {
  createGroup(groupId: string): void;
  drop(): Promise<void>;
  has(groupId: string): boolean;
  releaseAll(): void;
  releaseGroup(group: string): void;
  replaceDataParts(key: string, result: HarnessRunResult): Promise<void>;
  retrieveAsBlob(part: StoredDataCapabilityPart): Promise<Blob>;
  serializeGroup(
    group: string,
    storeId?: string
  ): Promise<SerializedDataStoreGroup | null>;
  store(blob: Blob, storeId?: string): Promise<StoredDataCapabilityPart>;
};

export type StateStore = {
  load(key?: string): Promise<ReanimationState | undefined>;
  save(state: ReanimationState): Promise<string>;
};
