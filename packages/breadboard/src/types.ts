/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Schema = {
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  format?: string;
  enum?: string[];
  /**
   * The default value of the schema. The UI can use this to pre-populate a
   * field with a value, if there is no `examples` present.
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

export interface Capability {
  readonly kind: string;
}

export type ErrorCapability = Capability & {
  readonly kind: "error";
  readonly error?: Error;
  readonly inputs?: InputValues;
  readonly descriptor?: NodeDescriptor;
};

/**
 * A type representing a valid JSON value.
 */
export type NodeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | NodeValue[]
  | Capability
  | { [key: string]: NodeValue };

/**
 * Unique identifier of a node in a graph.
 */
export type NodeIdentifier = string;

/**
 * Unique identifier of a node's output.
 */
export type OutputIdentifier = string;

/**
 * Unique identifier of a node's input.
 */
export type InputIdentifier = string;

/**
 * Unique identifier of a node's type.
 */
export type NodeTypeIdentifier = string;

/**
 * Represents a node in a graph.
 */
export type NodeDescriptor = {
  /**
   * Unique id of the node in graph.
   */
  id: NodeIdentifier;

  /**
   * Type of the node. Used to look up the handler for the node.
   */
  type: NodeTypeIdentifier;

  /**
   * Configuration of the node.
   */
  configuration?: NodeConfiguration;
};

/**
 * Represents an edge in a graph.
 */
export type Edge = {
  /**
   * The node that the edge is coming from.
   */
  from: NodeIdentifier;

  /**
   * The node that the edge is going to.
   */
  to: NodeIdentifier;

  /**
   * The input of the `to` node. If this value is undefined, then
   * the then no data is passed as output of the `from` node.
   */
  in?: InputIdentifier;

  /**
   * The output of the `from` node. If this value is "*", then all outputs
   * of the `from` node are passed to the `to` node. If this value is undefined,
   * then no data is passed to any inputs of the `to` node.
   */
  out?: OutputIdentifier;

  /**
   * If true, this edge is optional: the data that passes through it is not
   * considered a required input to the node.
   */
  optional?: boolean;

  /**
   * If true, this edge acts as a constant: the data that passes through it
   * remains available even after the node has consumed it.
   */
  constant?: boolean;
};

/**
 * Represents references to a "kit": a collection of `NodeHandlers`.
 * The basic permise here is that people can publish kits with interesting
 * handlers, and then graphs can specify which ones they use.
 * The `@google-labs/core-kit` package is an example of kit.
 */
export type KitReference = {
  /**
   * The URL pointing to the location of the kit.
   */
  url: string;
};

export type KitDescriptor = KitReference & {
  /**
   * The title of the kit.
   */
  title?: string;
  /**
   * The description of the kit.
   */
  description?: string;
  /**
   * Version of the kit.
   * [semver](https://semver.org/) format is encouraged.
   */
  version?: string;
};

/**
 * Represents graph metadata.
 */
export type GraphMetadata = {
  /**
   * The URL pointing to the location of the graph.
   * This URL is used to resolve relative paths in the graph.
   * If not specified, the paths are assumed to be relative to the current
   * working directory.
   */
  url?: string;
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
};

/**
 * Unique identifier of a graph.
 */
export type GraphIdentifier = string;

/**
 * Represents a collection of sub-graphs.
 * The key is the identifier of the sub-graph.
 * The value is the descriptor of the sub-graph.
 */
export type SubGraphs = Record<GraphIdentifier, GraphDescriptor>;

/**
 * Represents a graph.
 */
export type GraphDescriptor = GraphMetadata & {
  /**
   * The collection of all edges in the graph.
   */
  edges: Edge[];

  /**
   * The collection of all nodes in the graph.
   */
  nodes: NodeDescriptor[];

  /**
   * All the kits (collections of node handlers) that are used by the graph.
   */
  kits?: KitReference[];

  /**
   * Sub-graphs that are also described by this graph representation.
   */
  graphs?: SubGraphs;

  /**
   * Arguments that are passed to the graph, useful to bind values to lambdas.
   */
  args?: InputValues;
};

/**
 * The Map of queues of all outputs that were sent to a given node,
 * and a map of these for all nodes.
 */
export type NodeValuesQueues = Map<string, NodeValue[]>;
export type NodeValuesQueuesMap = Map<NodeIdentifier, NodeValuesQueues>;

export interface QueuedNodeValuesState {
  state: NodeValuesQueuesMap;
  constants: NodeValuesQueuesMap;
  wireOutputs(opportunites: Edge[], outputs: OutputValues): void;
  getAvailableInputs(nodeId: NodeIdentifier): InputValues;
  useInputs(node: NodeIdentifier, inputs: InputValues): void;
}

export interface CompletedNodeOutput {
  promiseId: symbol;
  outputs: OutputValues;
  newOpportunities: Edge[];
}

export interface TraversalResult {
  descriptor: NodeDescriptor;
  inputs: InputValues;
  missingInputs: string[];
  opportunities: Edge[];
  newOpportunities: Edge[];
  state: QueuedNodeValuesState;
  outputsPromise?: Promise<OutputValues>;
  pendingOutputs: Map<symbol, Promise<CompletedNodeOutput>>;
  skip: boolean;
}

/**
 * Values that are supplied as inputs to the `NodeHandler`.
 */
export type InputValues = Record<InputIdentifier, NodeValue>;

/**
 * Values that the `NodeHandler` outputs.
 */
export type OutputValues = Partial<Record<OutputIdentifier, NodeValue>>;

/**
 * Values that are supplied as part of the graph. These values are merged with
 * the `InputValues` and supplied as inputs to the `NodeHandler`.
 */
export type NodeConfiguration = Record<string, NodeValue>;

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
 * The result of running `NodeDescriptorFunction`
 */
export type NodeDescriberResult = {
  inputSchema: Schema;
  outputSchema: Schema;
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
  outputSchema?: Schema
) => Promise<NodeDescriberResult>;

export type NodeHandler =
  | {
      invoke: NodeHandlerFunction;
      describe?: NodeDescriberFunction;
    }
  | NodeHandlerFunction;

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
   */
  get invocationId(): number;
  /**
   * The timestamp of when this result was issued.
   */
  get timestamp(): number;
}

export interface NodeFactory {
  create<Inputs, Outputs>(
    kit: Kit | undefined,
    type: NodeTypeIdentifier,
    configuration?: NodeConfigurationConstructor,
    id?: string
  ): BreadboardNode<Inputs, Outputs>;
  getConfigWithLambda<Inputs, Outputs>(
    config: ConfigOrLambda<Inputs, Outputs>
  ): OptionalIdConfiguration;
}

export interface KitConstructor<T extends Kit> {
  new (nodeFactory: NodeFactory): T;
}

export type NodeSugar<In, Out> = (
  config?: ConfigOrLambda<In, Out>
) => BreadboardNode<In, Out>;

export type GenericKit<T extends NodeHandlers> = Kit & {
  [key in keyof T]: NodeSugar<unknown, unknown>;
};

/**
 * Validator metadata for a node.
 * Used e.g. in ProbeDetails.
 */
export interface BreadboardValidatorMetadata {
  description: string;
}

/**
 * A validator for a breadboard.
 * For example to check integrity using information flow control.
 */
export interface BreadboardValidator {
  /**
   * Add a graph and validate it.
   *
   * @param graph The graph to validate.
   * @throws Error if the graph is invalid.
   */
  addGraph(graph: GraphDescriptor): void;

  /**
   * Gets the validation metadata for a node.
   *
   * @param node Node to get metadata for.
   */
  getValidatorMetadata(node: NodeDescriptor): BreadboardValidatorMetadata;

  /**
   * Generate a validator for a subgraph, replacing a given node. Call
   * .addGraph() on the returned validator to add and validate the subgraph.
   *
   * @param node The node to replace.
   * @param actualInputs Actual inputs to the node (as opposed to assuming all
   * inputs with * or that optional ones are present)
   * @returns A validator for the subgraph.
   */
  getSubgraphValidator(
    node: NodeDescriptor,
    actualInputs?: string[]
  ): BreadboardValidator;
}

/**
 * Sequential number of the invocation of a node.
 * Useful for understanding the relative position of a
 * given invocation of node within the run.
 */
export type InvocationId = number;

/**
 * Information about a given invocation of a graph and
 * node within the graph.
 */
export type RunStackEntry = {
  /**
   * The invocation id of the graph.
   */
  graph: InvocationId;
  /**
   * The invocation id of the node within that graph.
   */
  node: InvocationId;
  /**
   * The state of the graph traversal at the time of the invocation.
   */
  state?: string;
};

/**
 * A stack of all invocations of graphs and nodes within the graphs.
 * The stack is ordered from the outermost graph to the innermost graph
 * that is currently being run.
 * Can be used to understand the current state of the run.
 */
export type RunState = RunStackEntry[];

export type GraphProbeData = {
  metadata: GraphMetadata;
  path: number[];
  timestamp: number;
};

export type GraphStartProbeMessage = {
  type: "graphstart";
  data: GraphProbeData;
};

export type GraphEndProbeMessage = {
  type: "graphend";
  data: GraphProbeData;
};

export type SkipProbeMessage = {
  type: "skip";
  data: {
    node: NodeDescriptor;
    inputs: InputValues;
    missingInputs: string[];
    path: number[];
    timestamp: number;
  };
};

export type NodeStartProbeMessage = {
  type: "nodestart";
  data: NodeStartResponse;
  state: RunState;
};

export type NodeEndProbeMessage = {
  type: "nodeend";
  data: NodeEndResponse;
};

export type ProbeMessage =
  | GraphStartProbeMessage
  | GraphEndProbeMessage
  | SkipProbeMessage
  | NodeStartProbeMessage
  | NodeEndProbeMessage;

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
  timestamp: number;
};

/**
 * Sent by the runner just before a node is about to run.
 */
export type NodeStartResponse = {
  /**
   * The description of the node that is about to run.
   * @see [NodeDescriptor]
   */
  node: NodeDescriptor;
  inputs: InputValues;
  path: number[];
  timestamp: number;
};

export type NodeEndResponse = {
  node: NodeDescriptor;
  inputs: InputValues;
  outputs: OutputValues;
  validatorMetadata?: BreadboardValidatorMetadata[];
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
  timestamp: number;
};

/**
 * Sent by the runner when an error occurs.
 * Error response also indicates that the board is done running.
 */
export type ErrorResponse = {
  /**
   * The error message.
   */
  error: string;
  timestamp: number;
};

// TODO: Remove extending EventTarget once new runner is converted to use
// reporting.
export interface Probe extends EventTarget {
  report?(message: ProbeMessage): Promise<void>;
}

export interface RunnerLike {
  run(
    context?: NodeHandlerContext,
    result?: BreadboardRunResult
  ): AsyncGenerator<BreadboardRunResult>;
  runOnce(
    inputs: InputValues,
    context?: NodeHandlerContext
  ): Promise<OutputValues>;
}

export interface BreadboardRunner extends GraphDescriptor, RunnerLike {
  kits: Kit[]; // No longer optional
  addValidator(validator: BreadboardValidator): void;
}

export interface Breadboard extends BreadboardRunner {
  input<In = InputValues, Out = OutputValues>(
    config?: OptionalIdConfiguration
  ): BreadboardNode<In, Out>;
  output<In = InputValues, Out = OutputValues>(
    config?: OptionalIdConfiguration
  ): BreadboardNode<In, Out>;
  lambda<In, InL extends In, OutL = OutputValues>(
    boardOrFunction: LambdaFunction<InL, OutL> | BreadboardRunner,
    config?: OptionalIdConfiguration
  ): BreadboardNode<In, LambdaNodeOutputs>;

  addEdge(edge: Edge): void;
  addNode(node: NodeDescriptor): void;
  addKit<T extends Kit>(ctr: KitConstructor<T>): T;
  currentBoardToAddTo(): Breadboard;
  addEdgeAcrossBoards(edge: Edge, from: Breadboard, to: Breadboard): void;
}

export type BreadboardCapability = Capability & {
  kind: "board";
  board: GraphDescriptor;
};

export interface NodeHandlerContext {
  readonly board?: BreadboardRunner;
  readonly descriptor?: NodeDescriptor;
  readonly kits?: Kit[];
  readonly base?: URL;
  readonly outerGraph?: GraphDescriptor;
  readonly slots?: BreadboardSlotSpec;
  readonly probe?: Probe;
  readonly requestInput?: (
    name: string,
    schema: Schema,
    node: NodeDescriptor
  ) => Promise<NodeValue>;
  readonly invocationPath?: number[];
  readonly state?: RunState;
}

export interface BreadboardNode<Inputs, Outputs> {
  /**
   * Wires the current node to another node.
   *
   * Use this method to wire nodes together.
   *
   * @param spec - the wiring spec. See the [wiring spec](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/wires.md) for more details.
   * @param to - the node to wire this node with.
   * @returns - the current node, to enable chaining.
   */
  wire<ToInputs, ToOutputs>(
    // spec: WireSpec<Inputs, Outputs, ToInputs, ToOutputs>,
    spec: string,
    to: BreadboardNode<ToInputs, ToOutputs>
  ): BreadboardNode<Inputs, Outputs>;

  readonly id: NodeIdentifier;
}

/**
 * A node configuration that can optionally have an `$id` property.
 *
 * The `$id` property is used to identify the node in the board and is not
 * passed to the node itself.
 */
export type OptionalIdConfiguration = {
  $id?: string;
} & NodeConfigurationConstructor;

/**
 * A node configuration that optionally has nodes as values. The Node()
 * constructor will remove those and turn them into wires into the node instead.
 */
export type NodeConfigurationConstructor = Record<
  string,
  NodeValue | BreadboardNode<InputValues, OutputValues>
>; // extends NodeConfiguration

/**
 * Synctactic sugar for node factories that accept lambdas. This allows passing
 * either
 *  - A JS function that is a lambda function defining the board
 *  - A board capability, i.e. the result of calling lambda()
 *  - A board node, which should be a node with a `board` output
 * or
 *  - A regular config, with a `board` property with any of the above.
 *
 * use `getConfigWithLambda()` to turn this into a regular config.
 */
export type ConfigOrLambda<In, Out> =
  | OptionalIdConfiguration
  | BreadboardCapability
  | BreadboardNode<LambdaNodeInputs, LambdaNodeOutputs>
  | GraphDescriptor
  | LambdaFunction<In, Out>
  | {
      board:
        | BreadboardCapability
        | BreadboardNode<LambdaNodeInputs, LambdaNodeOutputs>
        | LambdaFunction<In, Out>;
    };

export type LambdaFunction<In = InputValues, Out = OutputValues> = (
  board: Breadboard,
  input: BreadboardNode<In, Out>,
  output: BreadboardNode<In, Out>
) => void;

export type LambdaNodeInputs = InputValues & {
  /**
   * The (lambda) board this node represents. The purpose of the this node is to
   * allow wiring data into the lambda board, outside of where it's called.
   * This is useful when passing a lambda to a map node or as a slot.
   *
   * Note that (for now) each board can only be represented by one node.
   */
  board: BreadboardCapability;

  /**
   * All other inputs will be bound to the board.
   */
  args: InputValues;
};

export type LambdaNodeOutputs = OutputValues & {
  /**
   * The lambda board that can be run.
   */
  board: BreadboardCapability;
};
