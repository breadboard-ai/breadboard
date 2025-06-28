/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataStore, StateStore } from "./data.js";
import {
  GraphDescriptor,
  InputValues,
  NodeDescriptor,
  NodeTypeIdentifier,
  OutputValues,
} from "./graph-descriptor.js";
import { RunConfig, RunDiagnosticsLevel } from "./harness.js";
import { MutableGraphStore } from "./inspect.js";
import { GraphLoader } from "./loader.js";
import { ErrorResponse, Kit } from "./node-handler.js";
import {
  EdgeProbeMessage,
  GraphEndProbeMessage,
  GraphStartProbeMessage,
  NodeEndProbeMessage,
  NodeStartProbeMessage,
  SkipProbeMessage,
} from "./probe.js";
import { RunState } from "./run.js";
import { Schema } from "./schema.js";
import { TraversalResult } from "./traversal.js";

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
  path: number[];
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
   * The path to the node in the invocation tree, from the root graph.
   */
  path: number[];
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
export type RunRequestMessage = ["run", RunRequest, RunState?];
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
      result?: TraversalResult;
    } & ReplyFunction
  : never;

export type AnyClientRunResult = ClientRunResultFromMessage<RemoteMessage>;

export type AnyProbeClientRunResult =
  ClientRunResultFromMessage<DiagnosticsRemoteMessage>;

export type ClientRunResult<T> = T & ReplyFunction;

export type ServerRunRequest = {
  inputs?: InputValues;
  next?: string;
  diagnostics?: RunDiagnosticsLevel;
};

export type ServerRunConfig = {
  graph?: GraphDescriptor;
  url: string;
  kits: Kit[];
  writer: RemoteMessageWriter;
  loader: GraphLoader;
  graphStore: MutableGraphStore;
  dataStore: DataStore;
  stateStore: StateStore;
  inputs?: InputValues;
  diagnostics?: RunDiagnosticsLevel;
};

export type RemoteRunConfig = Omit<RunConfig, "kits">;

export type RemoteRunRequestBody = {
  $key: string;
  $next?: string;
  $diagnostics?: boolean;
} & InputValues;

/**
 * A detailed specification for ProxyServer and ProxyClient.
 *
 * Example:
 * ```js
 * {
 *   node: "secrets",
 *   protect: {
 *     PALM_KEY: ["palm-generateText", "palm-embedText"],
 *     NODE_SPECIFIC_KEY: "specific-node-type",
 *     PINECONE_KEY: {
 *       receiver: "fetch",
 *       inputs: {
 *        url: /\.pinecone\.io\/,
 *       },
 *     },
 *   }
 * }
 * ```
 */
export type NodeProxySpec = {
  /**
   * The node type to proxy. If specified, this node will be proxied.
   * For ProxyClient, this means that the node will be part of a special kit
   * that will proxy the inputs and outputs of the node to the ProxyServer.
   * For ProxyServer, this means that the server will proxy this node.
   */
  node: NodeTypeIdentifier;
  /**
   * If specified, describes the tunnels the outputs of the
   * node. This is useful for protecting secrets that are generated by the
   * node.
   *
   * This value is only used by the ProxyServer and is ignored by the
   * ProxyClient.
   *
   * The spec is an object where the keys are the output names and the values
   * are either:
   * - A string -- the node type id that has access to the tunneled output.
   * - An array of strings -- same as above, but a list of them.
   * - A VaultMatchOutputs object -- a more detailed specification for
   *  tunneling the output, which includes differentiating by the content of
   * a particular input of the node to which the tunnel leads.
   * For example, if a node has an input called `url` and you want to
   * tunnel only if the url matches a particular regex, you can
   * specify:
   * ```js
   * {
   *  receiver: "fetch",
   *  inputs: {
   *    url: /\.pinecone\.io\/,
   *  },
   * }
   * ```
   * - An array of VaultMatchOutputs objects -- same as above, but a
   * list of them.
   */
  tunnel?: TunnelSpec;
};

export type TunnelConstraints = {
  [inputName: string]: string | TunnelConstraint;
};

export type TunnelConstraint = {
  test(value: string): boolean;
};

export type TunnelDestinations = {
  to: NodeTypeIdentifier;
  when: TunnelConstraints;
};

export type TunnelSpec = {
  [outputName: string]:
    | TunnelDestinations
    | TunnelDestinations[]
    | string[]
    | string;
};

export type NodeProxyConfig = (NodeTypeIdentifier | NodeProxySpec)[];

export type AllowFilterFunction = (
  node: NodeDescriptor,
  inputs: InputValues
) => boolean;

export type ProxyServerConfig = {
  /**
   * The kits to use to provide the handlers for the nodes that are proxied.
   */
  kits: Kit[];
  /**
   * The proxy configuration. This is an array of node types or node specs.
   * @see NodeProxySpec for more details.
   */
  proxy?: NodeProxyConfig;
  /**
   * The data store to use for storing data.
   */
  store?: DataStore;
  /**
   * Allow filter.
   */
  allowed?: AllowFilterFunction;
};
