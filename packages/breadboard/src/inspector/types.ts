/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphIdentifier,
  GraphMetadata,
  ImportIdentifier,
  Module,
  ModuleCode,
  ModuleIdentifier,
  ModuleMetadata,
  EdgeMetadata,
  NodeMetadata,
  TraversalResult,
  UUID,
  AssetPath,
  AssetType,
  LLMContent,
} from "@breadboard-ai/types";
import { HarnessRunResult, SecretResult } from "../harness/types.js";
import { GraphLoader, GraphLoaderContext } from "../loader/types.js";
import {
  BehaviorSchema,
  Edge,
  ErrorResponse,
  GraphDescriptor,
  InputValues,
  Kit,
  KitDescriptor,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  NodeHandlerContext,
  NodeHandlerMetadata,
  NodeIdentifier,
  NodeTypeIdentifier,
  NodeValue,
  OutputValues,
  Schema,
} from "../types.js";
import {
  DataStore,
  FileSystem,
  Outcome,
  RunStore,
  SerializedDataStoreGroup,
} from "../data/types.js";
import { SequenceEntry } from "./run/serializer.js";
import { ReanimationState } from "../run/types.js";
import { Sandbox } from "@breadboard-ai/jsandbox";
import {
  AffectedNode,
  EditableGraph,
  EditableGraphOptions,
  Result,
} from "../editor/types.js";
import {
  TypedEventTarget,
  TypedEventTargetType,
} from "../utils/typed-event-target.js";

export type GraphVersion = number;

export type GraphURL = string;

export type InspectableNode = {
  /**
   * The `NodeDescriptor` for the node.
   */
  descriptor: NodeDescriptor;
  /**
   * The title of the node. Use this to get a consistent name for the node.
   * When the node has a title in the `NodeMetadata`, will be used.
   * Otherwise, the id of the node will be used.
   */
  title(): string;
  /**
   * The description of the node as found in `NodeMetadata`. If not found,
   * falls back to `title()`.
   */
  description(): string;
  /**
   * Returns the nodes that have an edge to this node.
   */
  incoming(): InspectableEdge[];
  /**
   * Returns the nodes that have an edge from this node.
   */
  outgoing(): InspectableEdge[];
  /**
   * Return true if the node is an entry node (labeled as such or
   * has no incoming edges)
   */
  isEntry(): boolean;
  /**
   * Return true if the node is an exit node (no outgoing edges)
   */
  isExit(): boolean;
  /**
   * Returns the `InspectableNodeType` instance for the node.
   */
  type(): InspectableNodeType;

  /**
   * Returns the API of the node.
   *
   * A note about the relationship between `describe`, `subgraph.describe`,
   * and `incoming`/`outgoing`:
   * - the `describe` returns the API as the node itself expects it
   * - the `incoming` and `outgoing` return the actual wires going in/out
   * - the `subgraph.describe` returns the API of the subgraph that the node
   *   contains (or represents). For instance, the `invoke` node has a `path`
   *   required property. This property will show up in `describe` (since it
   *   specifies the path of the graph), but not in `subgraph.describe` (since
   *   the subgraph itself doesn't actually use it).
   *
   * This function is designed to match the output of the
   * `NodeDescriberFunction`.
   */
  describe(inputs?: InputValues): Promise<NodeDescriberResult>;
  /**
   * Returns configuration of the node.
   * TODO: Use a friendlier to inspection return type.
   */
  configuration(): NodeConfiguration;
  /**
   * Returns metadata for the node.
   * TODO: Use a friendlier to inspection return type.
   */
  metadata(): NodeMetadata;
  /**
   * Returns the latest state of node's ports
   */
  ports(
    inputs?: InputValues,
    outputs?: OutputValues
  ): Promise<InspectableNodePorts>;

  /**
   * Returns the current state of node's ports. This value may contain
   * stale information, but is not async.
   */
  currentPorts(
    inputValues?: InputValues,
    outputValues?: OutputValues
  ): InspectableNodePorts;

  /**
   * Returns `true` if the node has been deleted from the graph and this
   * instance of `InspectableNode` no longer represents a valid node in
   * a graph. Returns `false` otherwise.
   */
  deleted(): boolean;
};

/**
 * The type of the edge.
 */
export enum InspectableEdgeType {
  /**
   * Just an ordinary edge. Most of the edges in graphs are ordinary.
   */
  Ordinary = "ordinary",
  /**
   * Constant edge has an effect of "memoizing" the value that passes
   * through it, make it always available. So when the incoming node is among
   * opportunities to visit again, the constant edge will report that it already
   * has the value.
   * Each new value that comes from the outgoing wire will overwrite the one
   * that is memoized.
   * Constant edges are primarily useful when building graphs with cycles.
   * For example, if you want to invoke some fetch multiple times, with the same
   * secret value, use the constant edge to connect the secret to the fetch.
   */
  Constant = "constant",
  /**
   * Control edge does not pass any data across. It is purely a control flow
   * wire, primarily useful when building graphs with cycles.
   */
  Control = "control",
  /**
   * Star edge is the opposite of control edge: it passes all data from outgoing
   * node to incoming node. Use it when you do not need to discern what
   * ports are being passed and their names match for the incoming/outgoing
   * nodes.
   */
  Star = "star",
}

export type InspectableEdge = {
  /**
   * The underlying Edge
   */
  raw(): Edge;
  /**
   * The outgoing node of the edge.
   */
  from: InspectableNode;
  /**
   * The name of the port of the outgoing node.
   */
  out: string;
  /**
   * The incoming node of the edge.
   */
  to: InspectableNode;
  /**
   * The name of the port of the incoming node.
   */
  in: string;
  /**
   * The type of the edge.
   */
  type: InspectableEdgeType;

  /**
   * Edge metadata
   */
  metadata(): EdgeMetadata | undefined;

  /**
   * Get an inspectable output port.
   */
  outPort(): Promise<InspectablePort>;

  /**
   * Get the inspectable input port.
   */
  inPort(): Promise<InspectablePort>;

  /**
   * Check if the input and output schemas are compatible (meaning that the
   * output port type is a subtype of the input port type).
   */
  validate(): Promise<ValidateResult>;

  /**
   * Returns `true` if the edge has been deleted from the graph and this
   * instance of `InspectableEdge` no longer represents a valid edge in
   * a graph. Returns `false` otherwise.
   */
  deleted(): boolean;
};

export type ValidateResult =
  | { status: "unknown"; errors?: never }
  | { status: "valid"; errors?: never }
  | { status: "invalid"; errors: ValidateError[] };

export interface ValidateError {
  message: string;
  detail?: {
    outputPath: Array<string | number>;
    inputPath: Array<string | number>;
  };
}

export type InspectableSubgraphs = Record<GraphIdentifier, InspectableGraph>;

export type InspectableGraph = {
  /**
   * Returns the underlying `GraphDescriptor` object.
   * TODO: Replace all uses of it with a proper inspector API.
   */
  raw(): GraphDescriptor;
  /**
   * Returns the main graph's descriptor
   */
  mainGraphDescriptor(): GraphDescriptor;
  /**
   * Returns this graph's metadata, if exists.
   */
  metadata(): GraphMetadata | undefined;
  /**
   * Returns the node with the given id, or undefined if no such node exists.
   * @param id id of the node to find
   */
  nodeById(id: NodeIdentifier): InspectableNode | undefined;
  /**
   * Returns all nodes in the graph.
   */
  nodes(): InspectableNode[];
  /**
   * Returns all edges of the graph.
   */
  edges(): InspectableEdge[];
  /**
   * Returns true if the edge exists in the graph.
   */
  hasEdge(edge: Edge): boolean;
  /**
   * Returns all nodes of the given type.
   * @param type type of the nodes to find
   */
  nodesByType(type: NodeTypeIdentifier): InspectableNode[];
  /**
   * Returns the `InspectableNodeType` for a given node or undefined if the
   * node does not exist.
   */
  typeForNode(id: NodeIdentifier): InspectableNodeType | undefined;
  /**
   * Returns the `InspectableNodeType` for a given type or undefined if the type
   * does not exist.
   */
  typeById(id: NodeTypeIdentifier): InspectableNodeType | undefined;
  /**
   * Returns the nodes that have an edge to the node with the given id.
   * @param id id of the node to find incoming nodes for
   */
  incomingForNode(id: NodeIdentifier): InspectableEdge[];
  /**
   * Returns the nodes that have an edge from the node with the given id.
   * @param id id of the node to find outgoing nodes for
   */
  outgoingForNode(id: NodeIdentifier): InspectableEdge[];
  /**
   * Returns a list of entry nodes for the graph.
   */
  entries(): InspectableNode[];
  /**
   * Returns the API of the graph. This function is designed to match the
   * output of the `NodeDescriberFunction`.
   */
  describe(
    inputs?: InputValues,
    context?: NodeHandlerContext
  ): Promise<NodeDescriberResult>;
  /**
   * Returns the subgraphs that are embedded in this graph or `undefined` if
   * this is already a subgraph
   */
  graphs(): InspectableSubgraphs | undefined;
  /**
   * Returns the id of this graph. If this is a main graph,
   * the value will be "". Otherwise, it will be the id of this subgraph.
   */
  graphId(): GraphIdentifier;
  /**
   * Returns a module by name.
   */
  moduleById(id: ModuleIdentifier): InspectableModule | undefined;
  /**
   * Returns the modules that are embedded in this graph.
   */
  modules(): InspectableModules;
  /**
   * Returns true if the graph represents an `ImperativeGraph` instance.
   * Imperative `InspectableGraph` will still show nodes and edges, but
   * it is just a fixed topology that represents how the graph is run.
   */
  imperative(): boolean;
  /**
   * Returns the name of the designated "main" module if this is an
   * `ImperativeGraph` instance and `undefined` if it is not yet set or
   * this is a `DeclarativeGraph` instance.
   */
  main(): string | undefined;
  /**
   * Returns all module exports
   */
  moduleExports(): Set<ModuleIdentifier>;
  /**
   * Returns all graph exports
   */
  graphExports(): Set<GraphIdentifier>;
  /**
   * Returns all imports, loading and creating appropriate `InspectableGraph`
   * instances.
   */
  imports(): Promise<Map<ImportIdentifier, Outcome<InspectableGraph>>>;
  /**
   * Returns graph assets.
   */
  assets(): Map<AssetPath, InspectableAsset>;
  /**
   * Returns asset edges.
   * Asset edge represents a connection between a node and an asset.
   * This value is computed dynamically based on the chiclets present in
   * node configuration.
   */
  assetEdges(): Outcome<InspectableAssetEdge[]>;
};

/**
 * Represents an asset edge.
 */
export type InspectableAsset = {
  readonly title: string;
  readonly description: string;
  readonly type: AssetType;
  readonly subType: string;
  readonly data: LLMContent[];
  readonly visual: Record<string, unknown>;
};

/**
 * Represents a connection between a node and an asset.
 */
export type InspectableAssetEdge = {
  /**
   * Can be either "load" or "save":
   * - "load" = (asset -> node), the asset is being loaded into the node
   * - "save" = (node -> asset), the node output is being saved into asset
   */
  readonly direction: InspectableAssetEdgeDirection;
  readonly assetPath: AssetPath;
  readonly asset: InspectableAsset;
  readonly node: InspectableNode;
};

export type InspectableAssetEdgeDirection = "load" | "save";

/**
 * Options to supply to the `inspectableGraph` function.
 */
export type InspectableGraphOptions = {
  /**
   * Optional, a list of kits to use when inspecting the graph. If not
   * supplied, the graph will be inspected without any kits.
   */
  kits?: Kit[];
  /**
   * The loader to use when loading boards.
   */
  loader?: GraphLoader;
  /**
   * The Javascript Sandbox that will be used to run custom describers.
   */
  readonly sandbox?: Sandbox;
  readonly fileSystem?: FileSystem;
};

export type DescribeResultCacheArgs = {
  initialType(): NodeDescriberResult;
  latestType(type: NodeTypeIdentifier): Promise<NodeDescriberResult>;
  updatedType(type: NodeTypeIdentifier): void;

  initial(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ): NodeDescriberResult;
  latest(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier,
    inputs?: InputValues
  ): Promise<NodeDescriberResult>;
  willUpdate(previous: NodeDescriberResult, current: NodeDescriberResult): void;
  updated(graphId: GraphIdentifier, nodeId: NodeIdentifier): void;
};

/**
 * Options to supply to the `describeType` function.
 */
export type NodeTypeDescriberOptions = {
  /**
   * Optional, the inputs to the node.
   */
  inputs?: InputValues;
  /**
   * Optional, the incoming edges to the node.
   */
  incoming?: InspectableEdge[];
  /**
   * Optional, the outgoing edges from the node.
   */
  outgoing?: InspectableEdge[];
  /**
   * Optional, describe the the type for type description purposes, rather
   * than for inspection.
   */
  asType?: boolean;
};

/**
 * Describes the current status of a node port.
 */
export enum PortStatus {
  /**
   * The port status impossible to determine. This only happens when the node
   * has a star wire ("*") and the port is not connected.
   */
  Indeterminate = "indeterminate",
  /**
   * The port is correctly connected to another node or specified using node's
   * configuration, according to this node's schema.
   */
  Connected = "connected",
  /**
   * The port is not connected to another node, and it is expected, but not
   * required by the node's schema.
   */
  Ready = "ready",
  /**
   * The port is not connected to another node, but it is required by the node's
   * schema. It is similar to "Ready", except that not having this port
   * connected is an error.
   */
  Missing = "missing",
  /**
   * The port is connected to this node, but it is not expected by the node's
   * schema. This is an error state.
   */
  Dangling = "dangling",
}

/**
 * Describes a node port (input or output).
 */
export type InspectablePort = {
  /**
   * The name of the port.
   */
  name: string;
  /**
   * The title of the port, if specified by schema. Otherwise, same as the
   * name of the port
   */
  title: string;
  /**
   * Returns current status of this port.
   */
  status: PortStatus;
  /**
   * Returns true if the port was specified in the node's configuration.
   */
  configured: boolean;
  /**
   * Returns current value for the port. This value is computed as follows:
   * - if there is a value coming from one of the incoming edges, then
   *   return that value;
   * - otherwise, if there is a value specified in node's configuration,
   *   then return that value;
   * - otherwise, return null;
   */
  value: NodeValue;
  /**
   * Returns true if this is the star or control port ("*" or "").
   */
  star: boolean;
  /**
   * Port schema as defined by the node's configuration.
   */
  schema: Schema;
  /**
   * Returns the edges connected to this port.
   */
  edges: InspectableEdge[];

  /**
   * Returns a representation of the port's type.
   */
  type: InspectablePortType;

  /**
   * Is this an input or output port?
   */
  kind: "input" | "output" | "side";
};

export type InspectablePortType = {
  /**
   * Returns port schema as defined by the node.
   */
  schema: Schema;
  /**
   * Returns `true` if this port has specified behavior
   */
  hasBehavior(behavior: BehaviorSchema): boolean;
  /**
   * Returns `true` if the outgoing port of this type can connect to an
   * incoming port of the specified type.
   *
   * @param to the incoming port type to which to connect.
   */
  canConnect(to: InspectablePortType): boolean;

  analyzeCanConnect(to: InspectablePortType): CanConnectAnalysis;
};

export type CanConnectAnalysis =
  | { canConnect: true; details?: never }
  | { canConnect: false; details: CanConnectAnalysisDetail[] };

export interface CanConnectAnalysisDetail {
  message: string;
  detail?: {
    outputPath: Array<string | number>;
    inputPath: Array<string | number>;
  };
}

/**
 * Represents one side (input or output) of ports of a node.
 */
export type InspectablePortList = {
  /**
   * Input ports of the node.
   */
  ports: InspectablePort[];
  /**
   * The behavior list that is on the input schema of a node, not the ports.
   */
  behavior?: BehaviorSchema[];
  /**
   * Returns true if the list of ports is fixed. Returns false if the node
   * expects a dynamic number of ports.
   *
   * Fixed example: the `validateJson` node, which has two fixed input ports:
   * `json` and `schema`.
   *
   * Conversely, the `core.invoke` node is an example of the dynamic number of
   * ports, which can take any number of inputs and they are passed to the
   * invoked graph as arguments.
   */
  fixed: boolean;
};

/**
 * Represents the input and output ports of a node.
 */
export type InspectableNodePorts = {
  /**
   * Returns the input ports of the node.
   */
  inputs: InspectablePortList;
  /**
   * Returns the output ports of the node.
   */
  outputs: InspectablePortList;
  /**
   * Return the side ports of the node.
   */
  side: InspectablePortList;
  /**
   * Returns `true` when the actually value is still being updated, and
   * the current value may be stale.
   */
  updating: boolean;
};

/**
 * Represents a Breadboard Kit associated with the board.
 */
export type InspectableKit = {
  /**
   * Returns the descriptor of the kit.
   */
  descriptor: KitDescriptor;
  /**
   * Returns the node types of the kit.
   */
  nodeTypes: InspectableNodeType[];
};

export type InspectableNodeType = {
  /**
   * Returns the metadata, associated with this node type.
   */
  metadata(): Promise<NodeHandlerMetadata>;

  /**
   * Same as above, but not async. The data may be stale. Listen to the
   * `update` events on GraphStore to get fresh metadata.
   */
  currentMetadata(): NodeHandlerMetadata;
  /**
   * Returns the type of the node.
   */
  type(): NodeTypeIdentifier;
  /**
   * Returns the ports of the node.
   */
  ports(): Promise<InspectableNodePorts>;
};

export type InspectableModule = {
  /**
   * Returns the metadata, associated with this node type.
   */
  metadata(): ModuleMetadata;

  /**
   *
   */
  code(): ModuleCode;
};

export type InspectableModules = Record<ModuleIdentifier, InspectableModule>;

export type NodeStoreMutator = {
  add(node: NodeDescriptor, graphId: GraphIdentifier): void;
  remove(id: NodeIdentifier, graphId: GraphIdentifier): void;
  addSubgraphNodes(subgraph: GraphDescriptor, graphId: GraphIdentifier): void;
  removeSubgraphNodes(graphId: GraphIdentifier): void;
};

export type EdgeStoreMutator = {
  add(edge: Edge, graphId: GraphIdentifier): void;
  remove(edge: Edge, graphId: GraphIdentifier): void;
  addSubgraphEdges(subgraph: GraphDescriptor, graphId: GraphIdentifier): void;
  removeSubgraphEdges(graphId: GraphIdentifier): void;
};

export type InspectableEdgeCache = EdgeStoreMutator & {
  get(edge: Edge, graphId: GraphIdentifier): InspectableEdge | undefined;
  getOrCreate(edge: Edge, graphId: GraphIdentifier): InspectableEdge;
  hasByValue(edge: Edge, graphId: GraphIdentifier): boolean;
  edges(graphId: GraphIdentifier): InspectableEdge[];
  rebuild(graph: GraphDescriptor): void;
};

export type InspectableNodeCache = NodeStoreMutator & {
  byType(type: NodeTypeIdentifier, graphId: GraphIdentifier): InspectableNode[];
  get(
    id: NodeIdentifier,
    graphId: GraphIdentifier
  ): InspectableNode | undefined;
  nodes(graphId: GraphIdentifier): InspectableNode[];
  rebuild(graph: GraphDescriptor): void;
};

export type InspectableModuleCache = {
  get(id: string): InspectableModule | undefined;
  add(id: string, module: Module): void;
  remove(id: ModuleIdentifier): void;
  modules(): InspectableModules;
  rebuild(graph: GraphDescriptor): void;
};

export type InspectableDescriberResultCacheEntry = {
  /**
   * When this promise is resolved, provides the latest/freshes value
   * of the `NodeDescriberResult`.
   */
  latest: Promise<NodeDescriberResult>;
  /**
   * Provides the current value, which may be stale.
   */
  current: NodeDescriberResult;
  /**
   * True when this is not the latest value, and the current value is
   * being updated
   */
  updating: boolean;
};

export type InspectableDescriberResultCache = {
  getByType(type: NodeTypeIdentifier): InspectableDescriberResultCacheEntry;
  get(
    id: NodeIdentifier,
    graphId: GraphIdentifier,
    inputs?: InputValues
  ): InspectableDescriberResultCacheEntry;
  update(affectedNodes: AffectedNode[]): void;
  clear(visualOnly: boolean, affectedNodes: AffectedNode[]): void;
};

export type InspectableKitCache = {
  getType(id: NodeTypeIdentifier): InspectableNodeType | undefined;
  addType(id: NodeTypeIdentifier, type: InspectableNodeType): void;
  rebuild(graph: GraphDescriptor): void;
};

export type InspectableGraphCache = {
  add(id: GraphIdentifier): void;
  get(id: GraphIdentifier): InspectableGraph | undefined;
  graphs(): InspectableSubgraphs;
  remove(id: GraphIdentifier): void;
  rebuild(graph: GraphDescriptor): void;
  clear(): void;
};

export type MainGraphIdentifier = UUID;

export type MainGraphStoreEntry = NodeHandlerMetadata & {
  id: MainGraphIdentifier;
  exports: MainGraphStoreExport[];
  exportTags: string[];
  updating: boolean;
};

export type MainGraphStoreExport = NodeHandlerMetadata & { updating: boolean };

export type GraphStoreEntry = NodeHandlerMetadata & {
  mainGraph: NodeHandlerMetadata & { id: MainGraphIdentifier };
  updating: boolean;
};

export type GraphStoreArgs = Required<InspectableGraphOptions>;

export type GraphStoreUpdateEvent = Event & {
  mainGraphId: MainGraphIdentifier;
  affectedGraphs: MainGraphIdentifier[];
  graphId: GraphIdentifier;
  nodeId: NodeIdentifier;
};

type GraphsStoreEventMap = {
  update: GraphStoreUpdateEvent;
};

export type GraphStoreEventTarget = TypedEventTarget<GraphsStoreEventMap>;

export type AddResult = {
  mutable: MutableGraph;
  graphId: GraphIdentifier;
  // NEED THIS, because describing is different for graphs and modules
  moduleId?: ModuleIdentifier;
  updating: boolean;
};

export type MutableGraphStore = TypedEventTargetType<GraphsStoreEventMap> &
  GraphLoader & {
    readonly kits: readonly Kit[];
    readonly sandbox: Sandbox;
    readonly loader: GraphLoader;
    readonly fileSystem: FileSystem;

    get(mainGraphId: MainGraphIdentifier): MutableGraph | undefined;

    mainGraphs(): MainGraphStoreEntry[];

    graphs(): GraphStoreEntry[];
    /**
     * This is a hacky API. Ideally, there's a list of graph entries
     * that is queriable and `graphs()` returns it, and this method
     * goes onto it.
     */
    getEntryByDescriptor(
      descriptor: GraphDescriptor,
      graphId: GraphIdentifier
    ): GraphStoreEntry | undefined;
    /**
     * Registers a Kit with the GraphStore.
     * Currently, only Kits that contain Graph URL-like types
     * are support.
     *
     * @param kit - the kit to register
     * @param dependences - known dependencies to this kit
     */
    registerKit(kit: Kit, dependences: MainGraphIdentifier[]): void;

    addByURL(
      url: string,
      dependencies: MainGraphIdentifier[],
      context: GraphLoaderContext
    ): AddResult;

    getLatest(mutable: MutableGraph): Promise<MutableGraph>;

    addByDescriptor(graph: GraphDescriptor): Result<MainGraphIdentifier>;
    getByDescriptor(graph: GraphDescriptor): Result<MainGraphIdentifier>;
    editByDescriptor(
      graph: GraphDescriptor,
      options?: EditableGraphOptions
    ): EditableGraph | undefined;
    edit(
      id: MainGraphIdentifier,
      options?: EditableGraphOptions
    ): EditableGraph | undefined;
    inspect(
      id: MainGraphIdentifier,
      graphId: GraphIdentifier
    ): InspectableGraph | undefined;
    inspectSnapshot(
      graph: GraphDescriptor,
      graphId: GraphIdentifier
    ): InspectableGraph | undefined;
  };

export type PortIdentifier = string;

export type PortChanges = {
  fixedChanged: boolean;
  deleted: PortIdentifier[];
  added: InspectablePort[];
  updated: InspectablePort[];
};

export type NodePortChanges = {
  input: PortChanges;
  output: PortChanges;
  side: PortChanges;
};

export type InspectablePortCache = {
  getChanges(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier,
    port: InspectableNodePorts
  ): NodePortChanges;
  current(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ): InspectableNodePorts | undefined;
};

/**
 * A backing store for `InspectableGraph` instances, representing a stable
 * instance of a graph whose properties mutate.
 */
export type MutableGraph = {
  graph: GraphDescriptor;
  legacyKitMetadata: KitDescriptor | null;
  readonly id: MainGraphIdentifier;
  readonly graphs: InspectableGraphCache;
  readonly store: MutableGraphStore;
  readonly nodes: InspectableNodeCache;
  readonly edges: InspectableEdgeCache;
  readonly modules: InspectableModuleCache;
  readonly describe: InspectableDescriberResultCache;
  readonly kits: InspectableKitCache;
  readonly ports: InspectablePortCache;

  update(
    graph: GraphDescriptor,
    visualOnly: boolean,
    affectedNodes: AffectedNode[],
    affectedModules: ModuleIdentifier[]
  ): void;

  addSubgraph(subgraph: GraphDescriptor, graphId: GraphIdentifier): void;
  removeSubgraph(graphId: GraphIdentifier): void;

  rebuild(graph: GraphDescriptor): void;
};

/**
 * Represents a result of loading a serialized `InspectableRun`
 */
export type InspectableRunLoadResult =
  | {
      success: false;
      error: string;
    }
  | {
      success: true;
      run: InspectableRun;
    };

/**
 * Represents an observer of the graph runs.
 */
export type InspectableRunObserver = {
  /**
   * Returns the list of runs that were observed. The current run is always
   * at the top of the list.
   */
  runs(): Promise<InspectableRun[]>;
  /**
   * Informs the observer that the run is resuming. This is useful to clean
   * up any transient state that might be awaiting the next result.
   * For example, secret's end timestamp is finalized this way
   */
  resume?(): void;
  /**
   * Observes the given result and collects it into the list of runs.
   * @param result -- the result to observe
   * @returns -- the list of runs that were observed
   */
  observe(result: HarnessRunResult): Promise<void>;
  /**
   * Attempts to load a JSON object as a serialized representation of runs,
   * creating a new run if successful.
   * @param o -- the object to load. Must be shaped as `SerializedRun`.
   * @returns -- an `InspectableRunLoadResult` instance.
   */
  load(
    o: unknown,
    options?: SerializedRunLoadingOptions
  ): Promise<InspectableRunLoadResult>;

  /**
   * Appends previously observed events to runs and creates
   * new runs if needed.
   * @param history -- inspectable run events to append
   */
  append(history: InspectableRunSequenceEntry[]): Promise<void>;

  /**
   * Replays the current run as a new run, stopping at the first encountered in
   * a given list of nodes.
   * If no run exists, does nothing.
   */
  replay(stopAt: NodeIdentifier[]): Promise<void>;
};

/**
 * Represents a function that replaces secrets.
 * @param name -- the name of the secret
 * @param value -- the current value of the secret
 * @returns -- the new value of the secret
 */
export type SerializedRunSecretReplacer = (
  name: string,
  value: string
) => string;

/**
 * Represents options to supply to the `load` method of `InspectableRunObserver`.
 */
export type SerializedRunLoadingOptions = {
  /**
   * Optional, a function replace sentinel values with actual secrets.
   */
  secretReplacer?: SerializedRunSecretReplacer;
  /**
   * Optional, a list of kits to use when inspecting the graph. If not
   * supplied, the graph will be inspected without any kits.
   */
  kits?: Kit[];
  /**
   * The loader to use when loading boards.
   */
  loader?: GraphLoader;
  /**
   * The Javascript Sandbox that will be used to run custom describers.
   */
  readonly sandbox?: Sandbox;
};

/**
 * Represents a pair of the nodestart and nodeend results that were generated
 * during the run.
 */
export type InspectableRunNodeEvent = {
  type: "node";
  /**
   * Unique identifier of the event.
   */
  id: EventIdentifier;
  /**
   * The graph that contains this node.
   */
  graph: InspectableGraph;
  /**
   * The `InspectableNode` instance associated with this node.
   */
  node: InspectableNode;
  /**
   * The timestamp of the `nodestart` event.
   */
  start: number;
  /**
   * The timestamp of the `nodeend` event. Can be null when the `nodeend` has
   * not been received yet.
   */
  end: number | null;
  /**
   * The inputs that were provided to the node
   */
  inputs: InputValues;
  /**
   * The outputs that were produced by the node. Can be null when the `nodeend`
   * has not been received yet.
   */
  outputs: OutputValues | null;
  /**
   * Returns true when the input or output node was bubbled up from a nested
   * graph. This is only populated for the top-level graph.
   */
  bubbled: boolean;
  /**
   * Returns true if the event should be hidden in the UI.
   */
  hidden: boolean;
  /**
   * Returns the list of nested runs that were (or are being) create when
   * this node was (is being) invoked.
   */
  runs: InspectableRun[];

  /**
   * The TraversalResult associated with with this event
   */
  traversalResult?: TraversalResult;
};

/**
 * Represents an error event that was generated during the run.
 */
export type InspectableRunErrorEvent = {
  type: "error";
  id: EventIdentifier;
  error: ErrorResponse["error"];
  /**
   * When the error was first observed.
   */
  start: number;
};

export type InspectableRunEdgeEvent = {
  type: "edge";
  id: EventIdentifier;
  edge: {
    /**
     * The outgoing node of the edge.
     */
    from?: string;
    /**
     * The name of the port of the outgoing node.
     */
    out?: string;
    /**
     * The incoming node of the edge.
     */
    to?: string;
    /**
     * The name of the port of the incoming node.
     */
    in?: string;
  };
  start: number;
  end: number;
  from?: number[];
  to?: number[];
  value?: InputValues;
};

export type InspectableRunSecretEvent = {
  type: "secret";
  id: EventIdentifier;
  keys: SecretResult["data"]["keys"];
  /**
   * When the `secrets` node was first observed.
   */
  start: number;
  /**
   * When the `secrets` node was handled.
   */
  end: number | null;
};

/**
 * A unique identifier for an `InspectableRunEvent` instance.
 */
export type EventIdentifier = string;

/**
 * Values that were submitted as inputs during a run.
 */
export type InspectableRunInputs = Map<NodeIdentifier, OutputValues[]>;

/**
 * Represent all events that can be inspected during a run.
 */
export type InspectableRunEvent =
  | InspectableRunNodeEvent
  | InspectableRunSecretEvent
  | InspectableRunErrorEvent
  | InspectableRunEdgeEvent;

export type InspectableRunEdge = {
  edge: Edge;
  value: NodeValue;
};

/**
 * Represents a single run of a graph.
 */
export type InspectableRun = {
  /**
   * The version of the graph that was run.
   */
  graphVersion: number;
  /**
   * Start time of the run.
   */
  start: number;
  /**
   * End time of the run. Can be null if the run has not finished yet.
   */
  end: number | null;
  /**
   * All events within this graph that have occurred during the run.
   * The nested graph events aren't included.
   */
  events: InspectableRunEvent[];
  edges: InspectableRunEdge[];
  /**
   * A way to associate data with the run.
   */
  dataStoreKey: string;
  /**
   * Returns the current `InspectableRunNodeEvent` if any.
   * This is useful for tracking the latest node that is being run.
   *
   * Note: this will return node events for nested runs as well as the
   * top-level run.
   */
  currentNodeEvent(): InspectableRunNodeEvent | null;
  /**
   * Returns the current run stack as a list of `InspectableRunNodeEvent`
   * instances.
   * The first item in the list represents the node in the top-level
   * graph that is currently being run.
   * The last item is the actual node that is being run, which may be in a
   * graph that is nested within the top-level graph.
   */
  stack(): InspectableRunNodeEvent[];
  /**
   * If present, returns a serialized representation of the run or null if
   * serialization of this run is not supported.
   */
  serialize?(options?: RunSerializationOptions): Promise<SerializedRun>;
  /**
   * Given an `EventIdentifier`, returns an `InspectableRunEvent` instance or
   * null if not found.
   */
  getEventById(id: EventIdentifier): InspectableRunEvent | null;
  /**
   * Creates a map of all inputs that were submitted during the run or `null`
   * if no inputs were submitted.
   */
  inputs(): InspectableRunInputs | null;
  /**
   * Signals that the run was resumed.
   */
  resume?(): void;
  /**
   * Returns a HarnessRunResult asynchronous generator that allows replaying
   * the run.
   */
  replay(): AsyncGenerator<HarnessRunResult>;
  /**
   * Return the ReanimationState at a given event Id. Useful for starting
   * a run from a given point in the run.
   * Optional, since not all InspectableRun implemenations can offer this
   * capability.
   */
  reanimationStateAt?(
    id: EventIdentifier,
    nodeConfig: NodeConfiguration | undefined
  ): Promise<ReanimationState>;
};

/**
 * Represents options to supply to the `serialize` method of `InspectableRun`.
 */
export type RunSerializationOptions = {
  /**
   * Optional, whether or not to elide secrets. When set to true, secrets
   * are kept as is. When set to false or not present, secrets are elided and
   * replaced with sentinel values.
   */
  keepSecrets?: boolean;
};

export type SequenceView = {
  sequence: InspectableRunSequenceEntry[];
  start: number;
};

export type InspectableRunSequenceEntry = SequenceEntry;

export type PathRegistryEntry = {
  path: number[];
  parent: PathRegistryEntry | null;
  children: PathRegistryEntry[];
  mainGraphId: MainGraphIdentifier | null;
  graphId: GraphIdentifier;
  graphStart: number;
  graphEnd: number | null;
  event: InspectableRunEvent | null;
  view: SequenceView | null;
  /**
   * Sidecars are events that are displayed at a top-level, but aren't
   * part of the main event list. Currently, sidecar events are:
   * - Input events that have bubbled up.
   * - Output events that have bubbled up.
   * - Secret events.
   * - Error events.
   */
  sidecars: InspectableRunEvent[];
  /**
   * Returns true if the entry has no children.
   */
  empty(): boolean;
  /**
   * Returns nested events for this entry.
   */
  events: InspectableRunEvent[];
  /**
   * Returns the edges associated with this entry.
   * These will be the various edges that were traveled when traversing
   * the graph associated with this entry.
   */
  edges: InspectableRunEdge[];
  /**
   * Returns an inspectable graph for the graph, associated with this entry.
   */
  graph: InspectableGraph | null;

  find(path: number[]): PathRegistryEntry | null;
};

export type RunObserverLogLevel =
  /**
   * Show only events that are marked as info.
   * Typically, these are useful for communicating the
   * broad picture of what the graph is doing.
   */
  | "info"
  /**
   * Show info events and debug events. This includes all
   * events that are emitted by the graph.
   */
  | "debug";

export type RunObserverOptions = {
  /**
   * Logging level.
   */
  logLevel?: RunObserverLogLevel;
  /**
   * The kits that are being used during this run. Used to provide
   * the ability to inspect graphs and nodes during the run.
   */
  kits?: Kit[];
  /**
   * The data store that will manage non-text data within the run.
   */
  dataStore?: DataStore;
  /**
   * The store that will be used to capture the run's data.
   */
  runStore?: RunStore;
  /**
   * Whether or not to skip replacing inlineData parts with storedData parts.
   */
  skipDataStore?: boolean;
  /**
   * The JS Sandbox that will be used to run custom describers
   */
  sandbox?: Sandbox;
};

export type GraphstartTimelineEntry = [
  type: "graphstart",
  data: {
    timestamp: number;
    path: number[];
    index: number;
    graph: GraphDescriptor | null;
    graphId: string;
    edges: InspectableRunEdge[];
  },
];

export type NodestartTimelineEntry = [
  type: "nodestart",
  data: {
    id: NodeIdentifier;
    graph: number;
    inputs: InputValues;
    path: number[];
    timestamp: number;
  },
];

// TODO: Figure out if this is permanent.
export type TimelineEntry =
  | [
      type: "graphend" | "input" | "output" | "secret" | "error" | "nodeend",
      data: unknown,
    ]
  | GraphstartTimelineEntry
  | NodestartTimelineEntry;

/**
 * Represents an `InspectableRun` that has been serialized into a JSON object.
 * This object can be used to store the run in a file or send it over the wire.
 * The serialized run can be deserialized back into an `InspectableRun` object
 * using the `InspectableRunObserver.load` method.
 */
export type SerializedRun = {
  $schema: "tbd";
  version: "0";
  secrets?: Record<string, string>;
  timeline: TimelineEntry[];
  data?: SerializedDataStoreGroup;
};

export type GraphDescriber = {
  describe(
    inputs?: InputValues,
    inputSchema?: Schema,
    outputSchema?: Schema,
    context?: NodeHandlerContext
  ): Promise<NodeDescriberResult>;
};

export type GraphDescriberFactory = (
  graphId: GraphIdentifier,
  mutable: MutableGraph
) => Outcome<GraphDescriber>;
