/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataStore, FileSystem } from "./data.js";
import {
  Capability,
  GraphDescriptor,
  GraphIdentifier,
  GraphInlineMetadata,
  GraphMetadata,
  InputValues,
  KitDescriptor,
  ModuleIdentifier,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
  OutputValues,
} from "./graph-descriptor.js";
import { MutableGraphStore } from "./inspect.js";
import {
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "./llm-content.js";
import { GraphLoader } from "./loader.js";
import { Probe } from "./probe.js";
import { ManagedRunState, RunState } from "./run.js";
import { Sandbox } from "./sandbox.js";
import { Schema } from "./schema.js";
import { TraversalResult } from "./traversal.js";

export type ErrorCapability = Capability & {
  readonly kind: "error";
  readonly error?: Error;
  readonly inputs?: InputValues;
  readonly descriptor?: NodeDescriptor;
};

/**
 * A capability that represents a data value passed over the wire.
 * This is useful for passing inline data (base64 encoded) over the wire, as
 * well as references to external resources.
 */
export type DataCapability = {
  kind: "data";
} & (InlineDataCapabilityPart | StoredDataCapabilityPart);

/**
 * A function that represents a type of a node in the graph.
 */
export type NodeHandlerFunction = (
  /**
   * The inputs that are supplied to the node.
   */
  inputs: InputValues,
  /**
   * The context of the node's invocation.
   */
  context: NodeHandlerContext
) => Promise<OutputValues | void>;

/**
 * Make sure that kit node names can't accidentally stomp over the properties
 * that describe a kit.
 */
export type ReservedNodeNames = {
  [key in keyof KitDescriptor]?: never;
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

/**
 * The result of running `NodeDescriptorFunction`
 */
export type NodeDescriberResult = GraphInlineMetadata & {
  metadata?: GraphMetadata;
  inputSchema: Schema;
  outputSchema: Schema;
  /**
   * A way for a describer to specify multiple entry points.
   * A common use case is a connector that offers multiple tools.
   * For a graph that contains exports, these will match the describer
   * results of the exports.
   */
  exports?: Record<GraphIdentifier, NodeDescriberExport>;
};

/**
 * Context that is supplied to the `NodeDescriberFunction`.
 */
export type NodeDescriberContext = {
  /**
   * The base URL of the graph.
   */
  base?: URL;
  /**
   * The graph in which the node is described.
   */
  outerGraph: GraphDescriptor;
  /**
   * The loader that can be used to load graphs.
   */
  loader?: GraphLoader;
  /**
   * Information about the wires currently connected to this node.
   */
  wires: NodeDescriberWires;
  /**
   * Kits that are available in the context of the node.
   */
  kits?: Kit[];
  /**
   * JS Sandbox that will be used to run the module describers.
   */
  sandbox?: Sandbox;
  /**
   * Graph Store: tracks all the graphs, changes to them, and their
   * dependencies.
   */
  graphStore?: MutableGraphStore;
  fileSystem?: FileSystem;
  /**
   * A hint that this describing operation is for a type, which allows the
   * describer to avoid doing extra work handling dynamic schemas, etc.
   */
  asType?: boolean;
};

export type NodeDescriberWires = {
  // Note we only include the output port of incoming wires, and the input port
  // of outgoing wires, because this object is consumed by describe functions,
  // and it wouldn't make sense to ask about ports on the node we're
  // implementing the describe function for, because that would be recursive.
  incoming: Record<string, { outputPort: NodeDescriberPort }>;
  outgoing: Record<string, { inputPort: NodeDescriberPort }>;
};

export type NodeDescriberPort = {
  describe(): Promise<Schema>;
};

/**
 * Asks to describe a node. Can be called in multiple ways:
 * - when called with no arguments, will produce the "default schema". That is,
 * the inputs/outputs that are always available.
 * - when called with inputs and schemas, will produce the "expected schema".
 * For example, when a node changes its schema based on the actual inputs,
 * it will return different schemas when inputs/schemas are supplied than
 * when they are not.
 */
export type NodeDescriberFunction = (
  inputs?: InputValues,
  inputSchema?: Schema,
  outputSchema?: Schema,
  /**
   * The context in which the node is described.
   */
  context?: NodeDescriberContext
) => Promise<NodeDescriberResult>;

export type NodeHandlerMetadata = {
  /**
   * Title of the node type.
   */
  title?: string;
  /**
   * Description of the node type.
   */
  description?: string;
  /**
   * An icon associated with this node type.
   * Can be a URL or a Material Design id.
   */
  icon?: string;
  /**
   * The URL of the node type.
   */
  url?: string;
  /**
   * Whether or not the node is deprecated.
   */
  deprecated?: boolean;
  /*
   * The tags associated with the node.
   */
  tags?: string[];
  /**
   * The documentation for the graph, expressed as a URL and optional description.
   */
  help?: {
    description?: string;
    url: string;
  };

  /**
   * Allows specifying relative order of this graph when it is represented
   * as a component in any menu. Currently used when populating the
   * quick access menu.
   */
  order?: number;

  updating?: boolean;

  example?: NodeConfiguration;
};

export type NodeHandlerObject = {
  invoke: NodeHandlerFunction;
  describe?: NodeDescriberFunction;
  metadata?: NodeHandlerMetadata;
};

export type NodeHandler = NodeHandlerObject | NodeHandlerFunction;

/**
 * All known node handlers.
 */
export type NodeHandlers = ReservedNodeNames &
  Record<NodeTypeIdentifier, NodeHandler>;

export interface Kit extends KitDescriptor {
  get handlers(): NodeHandlers;
}

export type BreadboardSlotSpec = Record<string, GraphDescriptor>;

export type RunResultType = "input" | "output";

export interface BreadboardRunResult {
  /**
   * Type of the run result. This property indicates where the board
   * currently is in the `run` process.
   */
  type: RunResultType;
  /**
   * The current node that is being visited. This property can be used to get
   * information about the current node, such as its id, type, and
   * configuration.
   */
  node: NodeDescriptor;
  /**
   * Any arguments that were passed to the `input` node that triggered this
   * stage.
   * Usually contains `message` property, which is a friendly message
   * to the user about what input is expected.
   * This property is only available when `ResultRunType` is `input`.
   */
  get inputArguments(): InputValues;
  /**
   * The input values the board is waiting for.
   * Set this property to provide input values.
   * This property is only available when `ResultRunType` is `input`.
   */
  set inputs(input: InputValues);
  /**
   * the output values the board is providing.
   * This property is only available when `ResultRunType` is `output`.
   */
  get outputs(): OutputValues;
  /**
   * Current state of the underlying graph traversal.
   * This property is useful for saving and restoring the state of
   * graph traversal.
   */
  get state(): TraversalResult;
  /**
   * The invocation id of the current node. This is useful for tracking
   * the node within the run, similar to an "index" property in map/forEach.
   * @deprecated Use `path` instead.
   */
  get invocationId(): number;
  /**
   * The path of the current node. Supersedes the `invocationId` property.
   */
  get path(): number[];
  /**
   * The timestamp of when this result was issued.
   */
  get timestamp(): number;
  /** The current run state associated with the result. */
  get runState(): RunState | undefined;

  save(): string;
}

export type ErrorObject = {
  /**
   * The error message. Can be a string or a more detailed object. For
   * example, fetch errors may return a JSON response from the server.
   */
  error: string | object;
  /**
   * The node that threw the error.
   */
  descriptor?: NodeDescriptor;
  /**
   * The inputs that were passed to the node that threw the error.
   */
  inputs?: InputValues;
};
/**
 * Sent by the runner when an error occurs.
 * Error response also indicates that the board is done running.
 */
export type ErrorResponse = {
  /**
   * The error message string or a more detailed error object
   */
  error: string | ErrorObject;
  code?: number;
  timestamp: number;
};

export interface NodeHandlerContext {
  readonly board?: GraphDescriptor;
  readonly descriptor?: NodeDescriptor;
  readonly kits?: Kit[];
  readonly base?: URL;
  /**
   * The loader that can be used to load graphs.
   * @see [GraphLoader]
   */
  readonly loader?: GraphLoader;
  readonly outerGraph?: GraphDescriptor;
  readonly probe?: Probe;
  /**
   * Allows a step to request inputs mid-run (aka "bubbling inputs")
   *
   * @param schema - the schema of an object describing requested properties
   * @param node - information about the node that requested properties
   * @param path - path to the node that requested properties
   * @param state - the curren run state
   * @returns
   */
  readonly requestInput?: (
    schema: Schema,
    node: NodeDescriptor,
    path: number[],
    state: RunState
  ) => Promise<OutputValues | undefined>;
  /**
   * Provide output directly to the user. This will bypass the normal output
   * flow and will not be passed as outputs.
   * @param output - The values to provide
   * @param schema - The schema to use for the output
   * @returns - Promise that resolves when the output is provided
   */
  readonly provideOutput?: (
    outputs: OutputValues,
    descriptor: NodeDescriptor,
    path: number[]
  ) => Promise<void>;
  readonly invocationPath?: number[];
  readonly state?: ManagedRunState;
  /**
   * The `AbortSignal` that can be used to stop the board run.
   */
  readonly signal?: AbortSignal;
  /**
   * The data store that can be used to store data across nodes.
   */
  readonly store?: DataStore;
  /**
   * JS Sandbox that will be used to run the imperative graphs.
   */
  sandbox?: Sandbox;
  /**
   * Graph Store: tracks all the graphs, changes to them, and their
   * dependencies.
   */
  graphStore?: MutableGraphStore;
  /**
   * The file system, provided as module capability.
   */
  fileSystem?: FileSystem;
}

export type RunArguments = NodeHandlerContext & {
  /**
   * Input values that will be used for bubbled inputs. If not found, a fallback
   * action will be taken. For example, the web-based harness will ask the user.
   */
  inputs?: InputValues;
  /**
   * The node id to use as an entry point. This is useful for specifying a
   * particular
   * node as the start of the run. If not provided, nodes without any incoming
   * edges will be used.
   */
  start?: NodeIdentifier;
  /**
   * The id of the node to stop the run after. In combination with `state`, can
   * be used to run parts of the board.
   * If not specified, runs the whole board.
   */
  stopAfter?: NodeIdentifier;
};

/**
 * The main argument to runGraph. Provides a way to point at a subgraph
 * within a graph, while making the whole graph available.
 */
export type GraphToRun = {
  graph: GraphDescriptor;
  subGraphId?: GraphIdentifier;
  moduleId?: ModuleIdentifier;
};
