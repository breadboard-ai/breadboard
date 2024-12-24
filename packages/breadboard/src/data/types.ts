/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataStoreHandle,
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { HarnessRunResult } from "../harness/types.js";
import { ReanimationState } from "../run/types.js";
import { Schema } from "../types.js";

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
  /**
   * Store a value for later use.
   *
   * @param key -- the key to store the value under
   * @param value -- the value to store, including null
   * @param schema -- the schema of the data to store
   * @param scope -- the scope to store the data in
   */
  storeData(
    key: string,
    value: object | null,
    schema: Schema,
    scope: DataStoreScope
  ): Promise<StoreDataResult>;
  retrieveData(key: string): Promise<RetrieveDataResult>;
};

export type StateStore = {
  load(key?: string): Promise<ReanimationState | undefined>;
  save(state: ReanimationState): Promise<string>;
};

export type StoreDataResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export type RetrieveDataResult =
  | {
      success: true;
      value: object | null;
      schema: Schema;
    }
  | {
      success: false;
      error: string;
    };

export type DataStoreScope = "run" | "session" | "client";

export type Outcome<T> = T | { $error: string };

export type FileSystemReadWriteRootDirectories =
  /**
   * Project-level persistent storage.
   * Lifetime = persistent, unmanaged
   */
  | "/local"
  /**
   * Session-scoped persistent storage
   * Lifetime = same as this object
   */
  | "/session"
  /**
   * Run-specific storage (execution state, inter-module data)
   * Lifetime = one run
   */
  | "/run"
  /**
   * Temporary storage
   * Lifetime = one module invocation
   */
  | "/tmp";

export type FileSystemReadOnlyRootDirectories =
  /**
   * Environment-provided read-only resources
   */
  | "/env"
  /**
   * Project-level read-only shared assets
   */
  | "/assets";

// Very, very basic path validation.
type ValidPath<
  Root extends string,
  Rest extends string,
> = Rest extends `${infer Dir}/${infer Next}`
  ? `${Root}/${Dir}/${Next}`
  : `${Root}/${Rest}`;

export type FileSystemReadWritePath = ValidPath<
  FileSystemReadWriteRootDirectories,
  string
>;

export type FileSystemPath =
  | FileSystemReadWritePath
  | ValidPath<FileSystemReadOnlyRootDirectories, string>;

export type FileSystemQueryArguments = {
  /**
   * Path to use to constrain the query.
   */
  path: FileSystemPath;
};

export type FileSystemQueryResult = Outcome<{
  entries: FileSystemQueryEntry[];
}>;

export type FileSystemQueryEntry =
  | {
      type: "text" | "directory";
      path: FileSystemPath;
    }
  | {
      type: "binary";
      path: FileSystemPath;
      mimeType: string;
    };

export type FileSystemReadArguments = {
  path: FileSystemPath;
};

export type FileSystemReadResult = Outcome<
  | {
      type: "text";
      data: string;
    }
  | {
      type: "binary";
      data: string;
      mimeType: string;
    }
>;

export type FileSystemWriteArguments =
  | {
      type: "text";
      path: FileSystemReadWritePath;
      /**
       * Set value to `null` to delete this file.
       */
      data: string | null;
    }
  | {
      type: "binary";
      path: FileSystemReadWritePath;
      data: string;
      mimeType: string;
    }
  | {
      path: FileSystemReadWritePath;
      /**
       * Set value to `null` to delete this file.
       */
      data: null;
    };

export type FileSystemWriteResult = Outcome<void>;

export type FileSystem = {
  query(args: FileSystemQueryArguments): Promise<FileSystemQueryResult>;
  read(args: FileSystemReadArguments): Promise<FileSystemReadResult>;
  write(args: FileSystemWriteArguments): Promise<FileSystemWriteResult>;
  /**
   * Clears `/run`
   */
  startRun(): void;
  /**
   * Clears `/tmp`.
   */
  startModule(): void;
};
