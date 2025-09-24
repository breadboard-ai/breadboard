/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystemPath,
  FileSystemQueryArguments,
  FileSystemQueryResult,
  FileSystemReadArguments,
  FileSystemReadResult,
  FileSystemWriteArguments,
  FileSystemWriteResult,
  Outcome,
} from "./data.js";
import {
  GraphMetadata,
  InputValues,
  NodeMetadata,
} from "./graph-descriptor.js";
import { LLMContent } from "./llm-content.js";
import { NodeDescriberExport } from "./node-handler.js";
import { InvokeInputs, InvokeOutputs } from "./sandbox.js";
import { Schema } from "./schema.js";

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
  /**
   * The FileSystem path to save the response to
   */
  file?: FileSystemPath;
  /**
   * If provided, saves the response as a stream file.
   * Only valid when "file" is supplied as well.
   */
  stream?: "sse" | "text" | "json";
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

export type InputInputs = {
  $metadata?: NodeMetadata;
  schema?: Schema;
} & Record<string, unknown>;

export type InputOutputs = Record<string, unknown>;

export type OutputInputs = {
  $metadata?: NodeMetadata;
  schema?: Schema;
} & Record<string, unknown>;

export type OutputOutputs = {
  delivered: boolean;
};

export type BlobInputs = {
  contents: LLMContent[];
  transform: "persistent-temporary";
};
export type BlobOutputs = {
  contents: LLMContent[];
};

export type DescribeInputs = {
  url: string;
  inputs?: InputValues;
  inputSchema?: Schema;
  outputSchema?: Schema;
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

export type Capabilities = {
  fetch(url: FetchInputs): Promise<FetchOutputs>;
  secrets<S extends string>(inputs: {
    $metadata?: NodeMetadata;
    keys: S[];
  }): Promise<{ [K in S]: string }>;
  invoke(inputs: InvokeInputs): Promise<InvokeOutputs>;
  input(inputs: InputInputs): Promise<InputOutputs>;
  output(inputs: OutputInputs): Promise<OutputOutputs>;
  describe(inputs: DescribeInputs): Promise<Outcome<DescribeOutputs>>;
  query(inputs: FileSystemQueryArguments): Promise<FileSystemQueryResult>;
  read(inputs: FileSystemReadArguments): Promise<FileSystemReadResult>;
  write(inputs: FileSystemWriteArguments): Promise<FileSystemWriteResult>;
  blob(inputs: BlobInputs): Promise<BlobOutputs>;
};
