/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Encodes a text string as a valid component of a Uniform Resource Identifier (URI).
 * @param uriComponent A value representing an unencoded URI component.
 */
declare function encodeURIComponent(
  uriComponent: string | number | boolean
): string;

interface Console {
  log(...data: any[]);
  error(...data: any[]);
  warn(...data: any[]);
}

declare var console: Console;

declare module "@fetch" {
  export type FetchInputs = {
    $metadata?: {
      title?: string;
      description?: string;
    };
    /**
     * The URL to fetch
     */
    url: string;
    /**
     * The HTTP method to use. "GET is default.
     */
    method?: "GET" | "POST" | "PUT" | "DELETE";
    /**
     * Headers to send with request
     */
    headers?: Record<string, string>;
    /**
     * The body of the request
     */
    body?: unknown;
  };

  export type FetchOutputs = {
    /**
     * The error object.
     */
    $error?: unknown;
    /**
     * The response from the fetch request
     */
    response: unknown;
    /**
     * The HTTP status code of the response
     */
    status: number;
    /**
     * The status text of the response
     */
    statusText: string;
    /**
     * The content type of the response
     */
    contentType: string;
    /**
     * The headers of the response
     */
    responseHeaders: Record<string, string>;
  };

  /**
   * A built-in capability of Breadboard to fetch data.
   */
  export default function fetch(url: FetchInputs): Promise<FetchOutputs>;
}

declare module "@secrets" {
  /**
   * A built-in capability of Breadboard to obtain secrets.
   */
  export default function secrets<S extends string>(inputs: {
    $metadata?: {
      title?: string;
      description?: string;
    };
    keys: S[];
  }): Promise<{ [K in S]: string }>;
}

declare module "@invoke" {
  export type InvokeInputs = {
    $metadata?: {
      title?: string;
      description?: string;
    };
    $board?: string;
    $start?: string;
    $stopAfter?: string;
  } & Record<string, unknown>;

  export type InvokeOutputs = Outcome<Record<string, unknown>>;

  /**
   * A built-in capability of Breadboard to invoke boards.
   */
  export default function invoke(inputs: InvokeInputs): Promise<InvokeOutputs>;
}

declare module "@output" {
  export type OutputInputs = {
    $metadata?: {
      title?: string;
      description?: string;
    };
    schema?: Schema;
  } & Record<string, unknown>;

  export type OutputOutputs = {
    delivered: boolean;
  };

  export default function output(inputs: OutputInputs): Promise<OutputOutputs>;
}

declare module "@describe" {
  export type DescribeInputs = {
    url: string;
    inputs?: Values;
    inputSchema?: Schema;
    outputSchema?: Schema;
  };

  export type DescribeOutputs = {
    $error?: string;
    title?: string;
    description?: string;
    metadata?: {
      icon?: string;
      tags?: string[];
      help?: {
        description?: string;
        url: string;
      };
    };
    inputSchema: Schema;
    outputSchema: Schema;
  };

  export default function describe(
    inputs: DescribeInputs
  ): Promise<DescribeOutputs>;
}

declare type FunctionCallCapabilityPart = {
  functionCall: {
    name: string;
    args: object;
  };
};

declare type FunctionResponseCapabilityPart = {
  functionResponse: {
    name: string;
    response: object;
  };
};

declare type TextCapabilityPart = {
  text: string;
};

declare type DataStoreHandle = string;

/**
 * Represents data that is stored by a DataStoreProvider.
 */
declare type StoredDataCapabilityPart = {
  storedData: {
    handle: DataStoreHandle;
    mimeType: string;
  };
};

declare type DataPart =
  | InlineDataCapabilityPart
  | StoredDataCapabilityPart
  | FunctionCallCapabilityPart
  | FunctionResponseCapabilityPart
  | TextCapabilityPart;

declare type LLMContent = {
  role?: string;
  parts: DataPart[];
};

/**
 * Represents inline data, encoded as a base64 string.
 */
declare type InlineDataCapabilityPart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

declare type BehaviorSchema =
  /**
   * This port is deprecated and is only there because there might be graphs
   * that still use it. Don't show it in the UI unless there are existing
   * incoming wires.
   */
  | "deprecated"
  /**
   * Indicates that this particular input port value should not be cached by
   * the input bubbling machinery.
   * Use this when you'd like to continually ask the user for the same input,
   * rather that re-using cached answer (default behavior).
   */
  | "transient"
  /**
   * Indicates that the output node should bubble up to the invoking runner,
   * if any.
   * This is useful for sending outputs to the user from inside of the nested
   * graphs.
   */
  | "bubble"
  /**
   * Indicates that the input our output port is a "BoardCapability".
   */
  | "board"
  /**
   * Indicates that the input or output port is a "StreamCapability".
   */
  | "stream"
  /**
   * Indicates that the input or output port is an "ErrorCapability".
   */
  | "error"
  /**
   * Indicates that the input port is usually configured, rather than wired in.
   */
  | "config"
  /**
   * Indicates that the input or output port represents base structured
   * datatype containing multi-part content of a message, generated by an LLM.
   * See [Content](https://ai.google.dev/api/rest/v1beta/Content) for details
   * on the datatype.
   */
  | "llm-content"
  /**
   * Indicates that the input or output port represents a JSON schema.
   */
  | "json-schema"
  /**
   * Indicates that the input or output port represents a JSON schema that
   * describes an input or output port.
   */
  | "ports-spec"
  /**
   * Indicates that the input or output port represents an image. The image can
   * be a URL or a base64 encoded image.
   */
  | "image"
  /**
   * Indicates that the input or output represents some sort of code
   */
  | "code"
  /**
   * Indicates that the string is a Google Drive Query. See
   * https://developers.google.com/drive/api/guides/search-files.
   */
  | "google-drive-query"
  /**
   * Indicates that the string is a Google Drive File ID.
   * https://developers.google.com/drive/api/guides/about-files#characteristics
   */
  | "google-drive-file-id"
  /**
   * Indicates that the string is a Module.
   */
  | "module"
  /**
   * Indicates that this is a side wire
   * See https://github.com/breadboard-ai/breadboard/issues/3788#issuecomment-2477813443
   */
  | "side";

declare type Schema = {
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  format?: string;
  /**
   * Can be used to provide additional hints to the UI or to other parts of
   * the system about behavior of this particular input/output or input/output
   * port.
   */
  behavior?: BehaviorSchema[];
  transient?: boolean;
  enum?: string[];
  /**
   * The default value of the schema. The UI can use this to pre-populate a
   * field with a value, if there is no "examples" present.
   */
  default?: string;
  additionalProperties?: boolean | Schema;
  items?: Schema | Schema[];
  minItems?: number;
  /**
   * Can be used by UI to pre-populate a field with a value that could be
   * used as an example.
   */
  examples?: string[];
};

declare type Outcome<T> = T | { $error: string };

declare type FileSystemReadWriteRootDirectories =
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

declare type FileSystemReadOnlyRootDirectories =
  /**
   * Environment-provided read-only resources
   */
  | "/env"
  /**
   * Project-level read-only shared assets
   */
  | "/assets";

// Very, very basic path validation.
declare type ValidPath<
  Root extends string,
  Rest extends string,
> = Rest extends `${infer Dir}/${infer Next}`
  ? `${Root}/${Dir}/${Next}`
  : `${Root}/${Rest}`;

declare type FileSystemReadWritePath = ValidPath<
  FileSystemReadWriteRootDirectories,
  string
>;

declare type FileSystemPath =
  | FileSystemReadWritePath
  | ValidPath<FileSystemReadOnlyRootDirectories, string>;

declare type FileSystemQueryArguments = {
  /**
   * Path to use to constrain the query.
   */
  path: FileSystemPath;
};

declare type FileSystemQueryResult = Outcome<{
  entries: FileSystemQueryEntry[];
}>;

declare type FileSystemQueryEntry = {
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

declare type FileSystemReadArguments = {
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

declare type FileSystemReadResult = Outcome<
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

declare type FileSystemWriteArguments =
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

declare type FileSystemWriteResult = Outcome<void>;

declare module "@query" {
  export default function query(
    inputs: FileSystemQueryArguments
  ): Promise<FileSystemQueryResult>;
}

declare module "@read" {
  export default function read(
    inputs: FileSystemReadArguments
  ): Promise<FileSystemReadResult>;
}

declare module "@write" {
  export default function write(
    inputs: FileSystemWriteArguments
  ): Promise<FileSystemWriteResult>;
}
