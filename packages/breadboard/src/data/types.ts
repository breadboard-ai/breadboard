/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataStoreHandle,
  FileDataPart,
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
  UUID,
} from "@breadboard-ai/types";
import { HarnessRunResult } from "../harness/types.js";
import { ReanimationState } from "../run/types.js";
import { Schema } from "../types.js";

export type SerializedStoredData = {
  handle: DataStoreHandle;
} & InlineDataCapabilityPart;

export type SerializedDataStoreGroup = SerializedStoredData[];

export type RunURL = string;
export type RunTimestamp = number;

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

export type DataInflator = {
  retrieveAsBlob(part: StoredDataCapabilityPart, graphUrl?: URL): Promise<Blob>;
  transformer?(graphUrl: URL): DataPartTransformer | undefined;
};

export type Chunk = {
  mimetype: string;
  data: string;
};

export type DataStore = DataInflator & {
  createGroup(groupId: string): void;
  drop(): Promise<void>;
  has(groupId: string): boolean;
  releaseAll(): void;
  releaseGroup(group: string): void;
  replaceDataParts(key: string, result: HarnessRunResult): Promise<void>;
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

/**
 * Specifies the type of the transformation:
 * - `persistent` -- converts every data part into a `StoredDataPart` pointing
 *   to the persistent handle (url that starts with https://)
 * - `persistent-temporary` -- same as `persistent`, but the URL is expected
 *    to live for a very short amount of time.
 * - `ephemeral` -- converts every data part into a `StoredDataPart` pointing
 *   to the ephemeral handle (a blob URL)
 * - `inline` -- converts every data part into an `InlineDataPart`.
 * - `file` -- converts every `StoreDataPart` pointing ot a persistent relative
 *   handle (url that starts with a `.`) into a `FileDataPart`
 */
export type DataPartTransformType =
  | "persistent"
  | "persistent-temporary"
  | "ephemeral"
  | "inline"
  | "file";

export type DataPartTransformer = {
  persistPart: (
    graphUrl: URL,
    part: InlineDataCapabilityPart,
    temporary: boolean
  ) => Promise<Outcome<StoredDataCapabilityPart>>;
  addEphemeralBlob: (blob: Blob) => StoredDataCapabilityPart;
  persistentToEphemeral: (
    part: StoredDataCapabilityPart
  ) => Promise<Outcome<StoredDataCapabilityPart>>;
  toFileData: (
    graphUrl: URL,
    part: StoredDataCapabilityPart | FileDataPart
  ) => Promise<Outcome<FileDataPart>>;
};

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
  /**
   * When set to `true`, inflates all stored parts to inline parts
   */
  inflate?: boolean;
};

export type FileSystemReadResult = Outcome<
  | {
      /**
       * Returns the concents of the file.
       */
      data: LLMContent[] | undefined;
      /**
       * The index of the last read LLMContent items in the file.
       * May be different from `data.length - 1`, because the read request
       * may ask for partial read.
       */
      last: number;
    }
  | {
      /**
       * Returns the current chunk in the stream or undefined if there's
       * no new chunk.
       */
      data: LLMContent[] | undefined;
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
      data: LLMContent[];
      /**
       * When set to `true`, appends data to the file, rather than
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
      data: LLMContent[];
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
       * Set to `true` to delete the file.
       */
      delete: true;
    };

export type FileSystemWriteResult = Outcome<void>;

export type FileSystemEntry = {
  path: FileSystemPath;
  data: LLMContent[];
};

export type FileSystemFile = {
  read(inflate: boolean, start?: number): Promise<FileSystemReadResult>;
  append(
    data: LLMContent[],
    done: boolean,
    receipt?: boolean
  ): Promise<Outcome<void>>;
  copy(): Outcome<FileSystemFile>;
  queryEntry(path: FileSystemPath): FileSystemQueryEntry;
  delete(): Promise<FileSystemWriteResult>;
  data: LLMContent[];
};

// Simplest possible backend.
export type FileMap = Map<FileSystemPath, FileSystemFile>;

export type PersistentBackend = {
  query(graphUrl: string, path: FileSystemPath): Promise<FileSystemQueryResult>;
  read(
    graphUrl: string,
    path: FileSystemPath,
    inflate: boolean
  ): Promise<Outcome<LLMContent[]>>;
  write(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult>;
  append(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult>;
  /**
   * Deletes files in persistent backend.
   * @param path - path to the file to delete
   * @param all - if `true`, will delete all files starting with `path`.
   */
  delete(
    graphUrl: string,
    path: FileSystemPath,
    all: boolean
  ): Promise<FileSystemWriteResult>;
  copy(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult>;
  move(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult>;
};

export type PersistentBlobHandle = `files:${UUID}`;
export type EphemeralBlobHandle = string;
export type EphemeralBlobStore = {
  byEphemeralHandle(
    handle: EphemeralBlobHandle
  ): PersistentBlobHandle | undefined;
  byPersistentHandle(handle: PersistentBlobHandle): string | undefined;
  add(
    blob: Blob,
    handle?: PersistentBlobHandle
  ): { ephemeral: EphemeralBlobHandle; persistent: PersistentBlobHandle };
  size: number;
};

export type OuterFileSystems = {
  graphUrl: string;
  local: PersistentBackend;
  env: FileSystemEntry[];
  blobs?: FileSystemBlobStore;
  assets: FileSystemEntry[];
  session?: FileMap;
  run?: FileMap;
};

export type FileSystemBlobTransform = {
  transform(
    path: FileSystemPath,
    part: InlineDataCapabilityPart | StoredDataCapabilityPart
  ): Promise<Outcome<InlineDataCapabilityPart | StoredDataCapabilityPart>>;
};

export type FileSystemBlobStore = {
  /**
   * Deletes blobs associated with the provided `path`.
   * If `options.all` is true, treats the provided path as
   * a directory and deletes all blobs associated with paths
   * that start with `path`.
   */
  delete(
    path: FileSystemPath,
    options?: { all?: boolean }
  ): Promise<Outcome<void>>;

  /**
   * Creates a transform that inflates all stored parts, converting
   * them from storedDataPart to inlineDataPart.
   */
  inflator(): FileSystemBlobTransform;

  /**
   * Creates a transform that deflates all inline paerts, converting
   * them from inlineDataPart to storedDataPart.
   */
  deflator(): FileSystemBlobTransform;

  /**
   * Does any necessary clean up at the end of the blob
   * store lifecycle.
   */
  close(): Promise<void>;

  /**
   * Ensures blob reference integrity when a copy of a file is made.
   */
  copy(
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<Outcome<void>>;

  /**
   * Ensures blob reference integrity when a file is moved.
   */
  move(
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<Outcome<void>>;
};

export type CreateRunFileSystemArgs = Omit<
  OuterFileSystems,
  "blobs" | "session" | "run" | "local"
>;

export type CreateModuleFileSystemArgs = {
  graphUrl: string;
  env?: FileSystemEntry[];
  assets?: FileSystemEntry[];
};

export type FileSystemWriteStreamArguments = {
  path: FileSystemPath;
  stream: ReadableStream<LLMContent>;
};

export type FileSystem = {
  query(args: FileSystemQueryArguments): Promise<FileSystemQueryResult>;
  read(args: FileSystemReadArguments): Promise<FileSystemReadResult>;
  write(args: FileSystemWriteArguments): Promise<FileSystemWriteResult>;
  /**
   * Hands a ReadableStream over to the FileSystem to manage as a stream
   * file.
   * @param args
   */
  addStream(args: FileSystemWriteStreamArguments): Promise<Outcome<void>>;
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
  createRunFileSystem(args: CreateRunFileSystemArgs): FileSystem;
  /**
   * Creates a new instance of a FileSystem that inherits all but `/tmp/`
   * from this instance.
   *
   * Use it to get the right FileSystem instance whenever a module is
   * invoked.
   */
  createModuleFileSystem(args: CreateModuleFileSystemArgs): FileSystem;
  /**
   * Provides a quick way to access env entries.
   */
  env(): FileSystemEntry[];
};
