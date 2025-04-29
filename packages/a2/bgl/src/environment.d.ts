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

declare function btoa(s: string | Uint8Array): string;
declare function atob(s: string): string;

interface Console {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...data: any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(...data: any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(...data: any[]);
}

// eslint-disable-next-line no-var
declare var console: Console;

declare type NodeMetadata = {
  title?: string;
  description?: string;
  icon?: string;
};

declare module "@fetch" {
  export type FetchInputs = {
    $metadata?: NodeMetadata;
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
    /**
     * Determines the browser's behavior in case the server replies
     * with a redirect status.
     */
    redirect?: "follow" | "error" | "manual";
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
    $metadata?: NodeMetadata;
    keys: S[];
  }): Promise<{ [K in S]: string }>;
}

declare module "@invoke" {
  export type InvokeInputs = {
    $metadata?: NodeMetadata;
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
    $metadata?: NodeMetadata;
    schema?: Schema;
  } & Record<string, unknown>;

  export type OutputOutputs = {
    delivered: boolean;
  };

  export default function output(inputs: OutputInputs): Promise<OutputOutputs>;
}

declare module "@blob" {
  export type BlobInputs = {
    contents: LLMContent[];
    transform: "persistent-temporary";
  };
  export type BlobOutputs = {
    contents: LLMContent[];
  };

  export default function blob(inputs: BlobInputs): Promise<BlobOutputs>;
}

declare module "@describe" {
  export type DescribeInputs = {
    url: string;
    inputs?: Record<string, JsonSerializable>;
    inputSchema?: Schema;
    outputSchema?: Schema;
  };

  export type GraphMetadata = {
    icon?: string;
    tags?: string[];
    help?: {
      description?: string;
      url: string;
    };
    order?: number;
  };

  /**
   * The individual export that is being exposed in NodeDescriberResult.
   */
  export type NodeDescriberExport = {
    title?: string;
    description: string;
    metadata?: GraphMetadata;
    inputSchema: Schema;
  };

  export type DescribeOutputs = {
    title?: string;
    description?: string;
    metadata?: GraphMetadata;
    inputSchema: Schema;
    outputSchema: Schema;
    /**
     * A way for a describer to specify multiple entry points.
     * A common use case is a connector that offers multiple tools.
     * For a graph that contains exports, these will match the describer
     * results of the exports.
     */
    exports?: Record<string, NodeDescriberExport>;
  };

  export default function describe(
    inputs: DescribeInputs
  ): Promise<Outcome<DescribeOutputs>>;
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

declare type FileDataPart = {
  fileData: {
    /**
     * Can be either a URL pointing to a YT video or a URL pointing at a
     * resource saved with File API.
     */
    fileUri: string;
    mimeType: string;
  };
};

declare type ExecutableCodePart = {
  executableCode: {
    language: "LANGUAGE_UNSPECIFIED" | "PYTHON";
    code: string;
  };
};

declare type CodeExecutionResultOutcome =
  // 	Unspecified status. This value should not be used.
  | "OUTCOME_UNSPECIFIED"
  // Code execution completed successfully.
  | "OUTCOME_OK"
  // Code execution finished but with a failure. stderr should contain the reason.
  | "OUTCOME_FAILED"
  // Code execution ran for too long, and was cancelled. There may or may not be a partial output present.
  | "OUTCOME_DEADLINE_EXCEEDED";

declare type CodeExecutionResultPart = {
  codeExecutionResult: {
    outcome: CodeExecutionResultOutcome;
    output: string;
  };
};

/**
 * Breadboard-specific addition to the LLM Content object, representing JSON
 * output.
 */
declare type JSONPart = {
  json: JsonSerializable;
};

declare type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | Array<JsonSerializable>
  | {
      [K: string]: JsonSerializable;
    };

declare type ListPartItem = {
  title?: string;
  content: LLMContent[];
};

declare type ListPart = {
  list: ListPartItem[];
  id: string;
};

declare type DataPart =
  | InlineDataCapabilityPart
  | StoredDataCapabilityPart
  | FileDataPart
  | ExecutableCodePart
  | CodeExecutionResultPart
  | FunctionCallCapabilityPart
  | FunctionResponseCapabilityPart
  | JSONPart
  | ListPart
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
   * Indicates that the input our output port is a `BoardCapability`.
   */
  | "board"
  /**
   * Indicates that the input or output port is a `StreamCapability`.
   */
  | "stream"
  /**
   * Indicates that the input or output port is an `ErrorCapability`.
   */
  | "error"
  /**
   * Indicates that the input port is usually configured, rather than wired in.
   */
  | "config"
  /**
   * In combination with "config", hints that the port value should be shown
   * (as a preview) when viewing the component in the context of the graph
   * or any other larger context.
   */
  | "hint-preview"
  /**
   * In combination with "config" and "reactive", hints that the port controls
   * the rest of the configuration and may be used as the first to be
   * displayed in the UI.
   */
  | "hint-controller"
  /**
   * Hints that the node is in a chat mode: it interacts with the user
   * as part of its invocation
   */
  | "hint-chat-mode"
  /**
   * In combination with "config", Indicates that this port is part of the
   * advanced configuration.
   */
  | "hint-advanced"

  /**
   * Hints that the text is short (e.g. a query) and needs a single line treatment.
   */
  | "hint-single-line"
  /**
   * Indicates that the input or output port represents an image. The image can
   * be a URL or a base64 encoded image.
   * For output ports, hints at the output type of image
   */
  | "hint-image"
  /**
   * Indicates that the input or output represents some sort of code.
   * For output ports, hints at the output type of code.
   */
  | "hint-code"
  /**
   * Hints that the port represents the text of some sort
   * (though the actual type could be LLMContent or JSON)
   */
  | "hint-text"
  /**
   * Hints that the port represents the audio
   */
  | "hint-audio"
  /**
   * Hints that the port represents a multimodal value (could be text, image,
   */
  | "hint-multimodal"
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
  | "side"
  /**
   * When a port is marked with it, indicates that this port is the main
   * input or output port, so that UI can treat it differently, like hoist
   * it into a header.
   */
  | "main-port"
  /**
   * Indicates that this entire node supports "@"-wiring, where the wires
   * are automatically created and allocated using a pre-defined scheme.
   */
  | "at-wireable"
  /**
   * Indicates that when the value of this port changes, the entire input
   * and/or output schema of the node may change as well, and a describer must
   * be invoked again to get the new schema.
   */
  | "reactive";

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
  /**
   * If present, allows specifying an icon for the property. This icon will
   * be used when rendering the property in an editor.
   */
  icon?: string;
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
