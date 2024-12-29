/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataStoreHandle,
  InlineDataCapabilityPart,
  LLMContent,
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

export type FileSystemQueryEntry = {
  path: FileSystemPath;
  /**
   * Returns `true` if this file is a stream. Streams are special kind of files
   * that can be written to and read from in chunks: each read empties
   * the contents (the chunk) of the file until the next write puts new chunk
   * into it.
   */
  stream: boolean;
  /**
   * Current number of LLMContent items in the file.
   */
  length: number;
};

export type FileSystemReadArguments = {
  path: FileSystemPath;
  /**
   * When specified, performs a partial read of the file.
   * The value must be a valid index in the LLMContent array.
   * Negative values count back from the last item in the array.
   */
  start?: number;
};

export type FileSystemReadResult = Outcome<
  | {
      /**
       * Returns the concents of the file.
       */
      context: LLMContent[] | undefined;
      /**
       * The index of the last read LLMContent items in the file.
       * May be different from `context.length - 1`, because the read request
       * may ask for partial read.
       */
      last: number;
    }
  | {
      /**
       * Returns the current chunk in the stream or undefined if there's
       * no new chunk.
       */
      context: LLMContent[] | undefined;
      /**
       * When the file is a stream, returns `true` when at the end of the
       * stream.
       */
      done: boolean;
    }
>;

export type FileSystemWriteArguments =
  | {
      path: FileSystemReadWritePath;
      context: LLMContent[];
      /**
       * When set to `true`, appends the context to the file, rather than
       * overwriting it.
       */
      append?: boolean;
      /**
       * When set to `true`, makes this file a stream.
       * Streams are special kind of files that can be written to and read from
       * in chunks: each read empties the contents (the chunk) of the file until
       * the next write puts new chunk into it.
       */
      stream?: false;
    }
  | {
      path: FileSystemReadWritePath;
      context: LLMContent[];
      stream: true;
      /**
       * A way to manage backpresssure and/or track read receipts.
       * If set to `true`, write will only resolve after the chunk has been
       * read. If set to `false`, write returns immediately.
       */
      receipt?: boolean;
      done?: false;
    }
  | {
      path: FileSystemReadWritePath;
      stream: true;
      /**
       * Signals the end of the stream.
       * Once the end of stream read, the stream file is deleted.
       */
      done: true;
    }
  | {
      path: FileSystemReadWritePath;
      /**
       * If specified, will efficiently copy data from source
       * to specified path.
       */
      source: FileSystemPath;
      /**
       * If `true`, will delete the source after copying to path.
       */
      move?: boolean;
    }
  | {
      path: FileSystemReadWritePath;
      /**
       * Set value to `null` to delete this file.
       */
      context: null;
    };

export type FileSystemWriteResult = Outcome<void>;

export type FileSystemEntry = {
  path: FileSystemPath;
  context: LLMContent[];
};

export type FileSystemFile = {
  read(start?: number): Promise<FileSystemReadResult>;
  append(
    context: LLMContent[],
    done: boolean,
    receipt?: boolean
  ): Promise<Outcome<void>>;
  copy(): Outcome<FileSystemFile>;
  queryEntry(path: FileSystemPath): FileSystemQueryEntry;
  delete(): Promise<FileSystemWriteResult>;
  context: LLMContent[];
};

// Simplest possible backend.
export type FileMap = Map<FileSystemPath, FileSystemFile>;

export type PersistentBackend = {
  query(path: FileSystemPath): Promise<FileSystemQueryResult>;
  read(path: FileSystemPath): Promise<Outcome<LLMContent[]>>;
  append(
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult>;
  delete(path: FileSystemPath): Promise<FileSystemWriteResult>;
};

export type OuterFileSystems = {
  local: PersistentBackend;
  env: FileSystemEntry[];
  assets: FileSystemEntry[];
  session?: FileMap;
  run?: FileMap;
};

export type FileSystem = {
  query(args: FileSystemQueryArguments): Promise<FileSystemQueryResult>;
  read(args: FileSystemReadArguments): Promise<FileSystemReadResult>;
  write(args: FileSystemWriteArguments): Promise<FileSystemWriteResult>;
  /**
   * Cleans up
   */
  close(): Promise<void>;
  /**
   * Creates a new instance of a FileSystem that inherits all but `/run/`
   * and `/tmp/` store from this instance.
   *
   * Use it to get the right FileSystem instance at the start of a run.
   */
  createRunFileSystem(): FileSystem;
  /**
   * Creates a new instance of a FileSystem that inherits all but `/tmp/`
   * from this instance.
   *
   * Use it to get the right FileSystem instance whenever a module is
   * invoked.
   */
  createModuleFileSystem(): FileSystem;
};
