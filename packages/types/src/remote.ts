/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeDescriptor,
  OutputValues,
} from "./graph-descriptor.js";
import { ErrorResponse } from "./node-handler.js";
import {
  EdgeProbeMessage,
  GraphEndProbeMessage,
  GraphStartProbeMessage,
  NodeEndProbeMessage,
  NodeStartProbeMessage,
  SkipProbeMessage,
} from "./probe.js";
import { Schema } from "./schema.js";

/**
 * Sent by the runner to supply outputs.
 */
export type OutputResponse = {
  /**
   * The description of the node that is providing output.
   * @see [NodeDescriptor]
   */
  node: NodeDescriptor;
  /**
   * The output values that the node is providing.
   * @see [OutputValues]
   */
  outputs: OutputValues;
  /**
   * Whether or not this input was bubbled.
   */
  bubbled: boolean;
  /**
   * Unique identifier for this node invocation within the current run.
   */
  index: string;
  timestamp: number;
};

/**
 * Sent by the runner to request input.
 */
export type InputResponse = {
  /**
   * The description of the node that is requesting input.
   * @see [NodeDescriptor]
   */
  node: NodeDescriptor;
  /**
   * The input arguments that were given to the node that is requesting input.
   * These arguments typically contain the schema of the inputs that are
   * expected.
   * @see [InputValues]
   */
  inputArguments: InputValues & { schema?: Schema };
  /**
   * Whether or not this input was bubbled.
   */
  bubbled: boolean;
  /**
   * The timestamp of the request.
   */
  timestamp: number;
};

/**
 * Sent by the client to request loading a board. This is an optional request
 * that may not be implemented in some environments (for example, a cloud
 * function that can only run one board).
 */
export type LoadRequest = {
  /**
   * The url of the board to load.
   */
  url: string;
};

/**
 * Sent by the server to indicate that the board is loaded.
 */
export type LoadResponse = {
  /**
   * The title of the graph.
   */
  title?: string;
  /**
   * The description of the graph.
   */
  description?: string;
  /**
   * Version of the graph.
   * [semver](https://semver.org/) format is encouraged.
   */
  version?: string;
  /**
   * The Mermaid diagram of the graph.
   */
  diagram?: string;
  /**
   * The url of the graph.
   */
  url?: string;
  /**
   * Information about the nodes in the graph.
   */
  nodes?: NodeDescriptor[];
};

type GenericResult = { type: string; data: unknown };

export type AsRemoteMessage<T extends GenericResult> = [
  T["type"],
  T["data"],
  next?: string,
];

/**
 * A run request is an empty object.
 * It basically just pokes the server to start running.
 */
export type RunRequest = Record<string, never>;
export type RunRequestMessage = ["run", RunRequest];
export type OutputRemoteMessage = ["output", OutputResponse];
export type InputRemoteMessage = ["input", InputResponse, next?: string];

/**
 * Sent by the client to provide inputs, requested by the server.
 */
export type InputResolveRequest = { inputs: InputValues };
export type InputResolveRequestMessage = [
  "input",
  InputResolveRequest,
  next?: string,
];

export type LastNode = {
  node: NodeDescriptor;
  missing: string[];
};

/**
 * Indicates that the board is done running.
 * Can only be the last message in the response stream.
 */
export type End = {
  timestamp: number;
  last?: LastNode;
};
export type EndRemoteMessage = ["end", End];
export type EndRequestMessage = ["end", End];

export type ErrorRemoteMessage = ["error", ErrorResponse];

/**
 * Sent by the client to request to proxy a node.
 */
export type ProxyRequest = {
  /**
   * The description of the node to be proxied.
   * @see [NodeDescriptor]
   */
  node: NodeDescriptor;
  /**
   * The input values that the board is providing to the node.
   * @see [InputValues]
   */
  inputs: InputValues;
};

/**
 * Sent by the server to respond to respond with the proxy results.
 */
export type ProxyResponse = {
  /**
   * The output values that the host is providing to the board in lieu of
   * the proxied node.
   * @see [OutputValues]
   */
  outputs: OutputValues;
};

export type ProxyRequestMessage = ["proxy", ProxyRequest];
export type ProxyResponseMessage = ["proxy", ProxyResponse];

export type ProxyChunkResponse = { chunk: unknown };
export type ProxyChunkResponseMessage = ["chunk", ProxyChunkResponse];

export type AnyProxyRequestMessage = ProxyRequestMessage | EndRequestMessage;
export type AnyProxyResponseMessage =
  | ProxyResponseMessage
  | ErrorRemoteMessage
  | ProxyChunkResponseMessage
  | EndRemoteMessage;

export type AnyRunRequestMessage =
  | RunRequestMessage
  | InputResolveRequestMessage;

export type NodeStartRemoteMessage = AsRemoteMessage<NodeStartProbeMessage>;
export type NodeEndRemoteMessage = AsRemoteMessage<NodeEndProbeMessage>;
export type GraphStartRemoteMessage = AsRemoteMessage<GraphStartProbeMessage>;
export type GraphEndRemoteMessage = AsRemoteMessage<GraphEndProbeMessage>;
export type SkipRemoteMessage = AsRemoteMessage<SkipProbeMessage>;
export type EdgeRemoteMessage = AsRemoteMessage<EdgeProbeMessage>;

export type DiagnosticsRemoteMessage =
  | NodeStartRemoteMessage
  | NodeEndRemoteMessage
  | GraphStartRemoteMessage
  | GraphEndRemoteMessage
  | SkipRemoteMessage
  | EdgeRemoteMessage;

export type RemoteMessage =
  | OutputRemoteMessage
  | InputRemoteMessage
  | EndRemoteMessage
  | ErrorRemoteMessage
  | DiagnosticsRemoteMessage;

export type RemoteMessageWriter = WritableStreamDefaultWriter<RemoteMessage>;
export type RemoteMessageWritableStream = WritableStream<RemoteMessage>;

type ReplyFunction = {
  reply: (chunk: AnyRunRequestMessage[1]) => Promise<void>;
};

type ClientRunResultFromMessage<ResponseMessage> = ResponseMessage extends [
  string,
  object,
  string?,
]
  ? {
      type: ResponseMessage[0];
      data: ResponseMessage[1];
    } & ReplyFunction
  : never;

export type AnyClientRunResult = ClientRunResultFromMessage<RemoteMessage>;

export type AnyProbeClientRunResult =
  ClientRunResultFromMessage<DiagnosticsRemoteMessage>;

export type ClientRunResult<T> = T & ReplyFunction;
