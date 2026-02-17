/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataStoreHandle,
  FileDataPart,
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
} from "./llm-content.js";

export type SerializedStoredData = {
  handle: DataStoreHandle;
} & InlineDataCapabilityPart;

export type SerializedDataStoreGroup = SerializedStoredData[];

export type Chunk = {
  mimetype: string;
  data: string;
};

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
    part: InlineDataCapabilityPart | StoredDataCapabilityPart,
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
   * Mountable (and system-mounted) storage. This might not be actually
   * storage per se, but anything that looks like a file system.
   */
  | "/mnt"
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
