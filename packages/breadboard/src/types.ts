/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Capability,
  Edge,
  GraphDescriptor,
  GraphMetadata,
  InputValues,
  KitDescriptor,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
  NodeValue,
  OutputValues,
} from "@google-labs/breadboard-schema/graph.js";

export type {
  Capability,
  Edge,
  GraphDescriptor,
  GraphIdentifier,
  GraphMetadata,
  InputIdentifier,
  InputValues,
  KitDescriptor,
  KitReference,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
  NodeValue,
  OutputIdentifier,
  OutputValues,
  SubGraphs,
} from "@google-labs/breadboard-schema/graph.js";

export type BehaviorSchema =
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
  | "bubble";

export type Schema = {
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

export type ErrorCapability = Capability & {
  readonly kind: "error";
  readonly error?: Error;
  readonly inputs?: InputValues;
  readonly descriptor?: NodeDescriptor;
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

export type ErrorObject = {
  /**
   * The error message. Can be a string or a more detailed object. For
   * example, fetch errors may return a JSON response from the server.
   */
  error: string | object;
  /**
   * The node that threw the error.
   */
  descriptor: NodeDescriptor;
  /**
   * The inputs that were passed to the node that threw the error.
   */
  inputs: InputValues;
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
  /**
   * Provide output directly to the user. This will bypass the normal output
   * flow and will not be passed as outputs.
   * @param output - The values to provide
   * @param schema - The schema to use for the output
   * @returns - Promise that resolves when the output is provided
   */
  readonly provideOutput?: (
    outputs: OutputValues,
    descriptor: NodeDescriptor
  ) => Promise<void>;
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
