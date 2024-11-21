/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  GraphMetadata,
  InputValues,
  ModuleIdentifier,
} from "@breadboard-ai/types";
import { getHandler } from "../handler.js";
import { createLoader } from "../loader/index.js";
import { invokeGraph } from "../run/invoke-graph.js";
import {
  invokeDescriber,
  invokeMainDescriber,
} from "../sandboxed-run-module.js";
import { combineSchemas, removeProperty } from "../schema.js";
import {
  Edge,
  GraphDescriptor,
  NodeDescriberContext,
  NodeDescriberFunction,
  NodeDescriberResult,
  NodeHandler,
  NodeIdentifier,
  NodeTypeIdentifier,
  Schema,
} from "../types.js";
import { graphUrlLike } from "../utils/graph-url-like.js";
import { EdgeCache } from "./edge.js";
import { collectKits, createGraphNodeType } from "./kits.js";
import { ModuleCache } from "./module.js";
import { NodeCache } from "./node.js";
import { DescribeResultCache } from "./run/describe-cache.js";
import {
  EdgeType,
  describeInput,
  describeOutput,
  edgesToSchema,
} from "./schemas.js";
import {
  InspectableEdge,
  InspectableEdgeCache,
  InspectableGraphOptions,
  InspectableGraphWithStore,
  InspectableKit,
  InspectableModules,
  InspectableNode,
  InspectableNodeCache,
  InspectableNodeType,
  InspectableSubgraphs,
  MutableGraph,
  NodeTypeDescriberOptions,
} from "./types.js";
import { VirtualNode } from "./virtual-node.js";
import {
  isImperativeGraph,
  toDeclarativeGraph,
} from "../run/run-imperative-graph.js";

export const inspectableGraph = (
  graph: GraphDescriptor,
  options?: InspectableGraphOptions
): InspectableGraphWithStore => {
  return new Graph(graph, "", undefined, undefined, options);
};

const maybeURL = (url?: string): URL | undefined => {
  url = url || "";
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
};

type CustomDescriberResult =
  | {
      success: true;
      result: NodeDescriberResult;
    }
  | {
      success: false;
    };

class Graph implements InspectableGraphWithStore {
  #url?: URL;
  #kits?: InspectableKit[];
  #nodeTypes?: Map<NodeTypeIdentifier, InspectableNodeType>;
  #options: InspectableGraphOptions;

  #graph: GraphDescriptor;
  #graphId: GraphIdentifier;
  #parent: GraphDescriptor | null = null;
  #cache: MutableGraph;
  #graphs: InspectableSubgraphs | null = null;

  #imperativeMain: ModuleIdentifier | undefined;

  constructor(
    graph: GraphDescriptor,
    graphId: GraphIdentifier,
    nodeCache?: InspectableNodeCache,
    edgeCache?: InspectableEdgeCache,
    options?: InspectableGraphOptions
  ) {
    this.#graphId = graphId;
    if (graphId) {
      const subGraph = graph.graphs?.[graphId];
      if (!subGraph) {
        throw new Error(
          `Inspect API integrity error: no sub-graph with id "${graphId}" found`
        );
      }
      this.#parent = graph;
      graph = subGraph;
      if (!nodeCache || !edgeCache) {
        throw new Error(
          `Inspect API integrity error: parent graph cache not supplied to a sub-graph.`
        );
      }
    }
    if (isImperativeGraph(graph)) {
      const { main } = graph;
      this.#graph = toDeclarativeGraph(graph);
      this.#imperativeMain = main;
    } else {
      this.#graph = graph;
    }
    this.#url = maybeURL(this.#graph.url);
    this.#options = options || {};
    const nodes = nodeCache || new NodeCache(this);
    let edges;
    if (edgeCache) {
      edges = edgeCache;
    } else {
      edges = new EdgeCache(nodes);
      edges.populate(this.#graph);
    }
    const modules = new ModuleCache();
    modules.populate(this.#graph);
    const describe = new DescribeResultCache();

    this.#cache = { edges, nodes, modules, describe };
  }

  raw() {
    return this.#graph;
  }

  imperative(): boolean {
    return !!this.#imperativeMain;
  }

  main(): string | undefined {
    return this.#imperativeMain;
  }

  metadata(): GraphMetadata | undefined {
    return this.#graph.metadata;
  }

  nodesByType(type: NodeTypeIdentifier): InspectableNode[] {
    return this.#cache.nodes.byType(type, this.#graphId);
  }

  async #getDescriber(
    type: NodeTypeIdentifier
  ): Promise<NodeDescriberFunction | undefined> {
    const { kits } = this.#options;
    const loader = this.#options.loader || createLoader();
    let handler: NodeHandler | undefined;
    try {
      handler = await getHandler(type, {
        kits,
        loader,
      });
    } catch (e) {
      console.warn(`Error getting describer for node type ${type}`, e);
    }
    if (!handler || !("describe" in handler) || !handler.describe) {
      return undefined;
    }
    return handler.describe;
  }

  async describeNodeType(
    id: NodeIdentifier,
    type: NodeTypeIdentifier,
    options: NodeTypeDescriberOptions = {}
  ): Promise<NodeDescriberResult> {
    return this.#cache.describe.getOrCreate(id, async () => {
      // The schema of an input or an output is defined by their
      // configuration schema or their incoming/outgoing edges.
      if (type === "input") {
        if (this.#imperativeMain) {
          if (!this.#options.sandbox) {
            throw new Error(
              "Sandbox not supplied, won't be able to describe this graph correctly"
            );
          }
          const result = await invokeMainDescriber(
            this.#options.sandbox,
            this.#graph,
            options.inputs!,
            {},
            {}
          );
          if (result)
            return describeInput({
              inputs: {
                schema: result.inputSchema,
              },
              incoming: options?.incoming,
              outgoing: options?.outgoing,
            });
          return describeInput(options);
        }
        return describeInput(options);
      }
      if (type === "output") {
        if (this.#imperativeMain) {
          if (!this.#options.sandbox) {
            throw new Error(
              "Sandbox not supplied, won't be able to describe this graph correctly"
            );
          }
          const result = await invokeMainDescriber(
            this.#options.sandbox,
            this.#graph,
            options.inputs!,
            {},
            {}
          );
          if (result)
            return describeOutput({
              inputs: {
                schema: result.outputSchema,
              },
              incoming: options?.incoming,
              outgoing: options?.outgoing,
            });
          return describeInput(options);
        }
        return describeOutput(options);
      }

      const { kits } = this.#options;
      const describer = await this.#getDescriber(type);
      const asWired = {
        inputSchema: edgesToSchema(EdgeType.In, options?.incoming),
        outputSchema: edgesToSchema(EdgeType.Out, options?.outgoing),
      } satisfies NodeDescriberResult;
      if (!describer) {
        return asWired;
      }
      const loader = this.#options.loader || createLoader();
      const context: NodeDescriberContext = {
        outerGraph: this.#parent || this.#graph,
        loader,
        kits,
        sandbox: this.#options.sandbox,
        wires: {
          incoming: Object.fromEntries(
            (options?.incoming ?? []).map((edge) => [
              edge.in,
              {
                outputPort: {
                  describe: async () => (await edge.outPort()).type.schema,
                },
              },
            ])
          ),
          outgoing: Object.fromEntries(
            (options?.outgoing ?? []).map((edge) => [
              edge.out,
              {
                inputPort: {
                  describe: async () => (await edge.inPort()).type.schema,
                },
              },
            ])
          ),
        },
      };
      if (this.#url) {
        context.base = this.#url;
      }
      try {
        return describer(
          options?.inputs || undefined,
          asWired.inputSchema,
          asWired.outputSchema,
          context
        );
      } catch (e) {
        console.warn(`Error describing node type ${type}`, e);
        return asWired;
      }
    });
  }

  nodeById(id: NodeIdentifier) {
    if (this.#graph.virtual) {
      return new VirtualNode({ id });
    }
    return this.#cache.nodes.get(id, this.#graphId);
  }

  nodes(): InspectableNode[] {
    return this.#cache.nodes.nodes(this.#graphId);
  }

  moduleById(id: ModuleIdentifier) {
    return this.#cache.modules.get(id);
  }

  modules(): InspectableModules {
    return this.#cache.modules.modules();
  }

  edges(): InspectableEdge[] {
    return this.#cache.edges.edges(this.#graphId);
  }

  hasEdge(edge: Edge): boolean {
    return this.#cache.edges.hasByValue(edge, this.#graphId);
  }

  kits(): InspectableKit[] {
    return (this.#kits ??= collectKits(
      { kits: this.#options.kits, loader: this.#options.loader },
      this.#graph.nodes
    ));
  }

  typeForNode(id: NodeIdentifier): InspectableNodeType | undefined {
    const node = this.nodeById(id);
    if (!node) {
      return undefined;
    }
    return this.typeById(node.descriptor.type);
  }

  typeById(id: NodeTypeIdentifier): InspectableNodeType | undefined {
    const kits = this.kits();
    this.#nodeTypes ??= new Map(
      kits.flatMap((kit) => kit.nodeTypes.map((type) => [type.type(), type]))
    );
    const knownNodeType = this.#nodeTypes.get(id);
    if (knownNodeType) {
      return knownNodeType;
    }
    if (!graphUrlLike(id)) {
      return undefined;
    }
    return createGraphNodeType(id, this.#options);
  }

  incomingForNode(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph.edges
      .filter((edge) => edge.to === id)
      .map((edge) => this.#cache.edges.getOrCreate(edge, this.#graphId));
  }

  outgoingForNode(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph.edges
      .filter((edge) => edge.from === id)
      .map((edge) => this.#cache.edges.getOrCreate(edge, this.#graphId));
  }

  entries(): InspectableNode[] {
    return this.#cache.nodes
      .nodes(this.#graphId)
      .filter((node) => node.isEntry());
  }

  async #describeWithStaticAnalysis(): Promise<NodeDescriberResult> {
    const inputSchemas = (
      await Promise.all(
        this.nodesByType("input")
          .filter((n) => n.isEntry())
          .map((input) =>
            describeInput({
              inputs: input.configuration(),
              incoming: input.incoming(),
              outgoing: input.outgoing(),
              asType: true,
            })
          )
      )
    ).map((result) => result.outputSchema);

    const outputSchemas = (
      await Promise.all(
        this.nodesByType("output")
          .filter((n) => n.isExit())
          .map((output) =>
            describeOutput({
              inputs: output.configuration(),
              incoming: output.incoming(),
              outgoing: output.outgoing(),
              asType: true,
            })
          )
      )
    )
      .map((result) =>
        result.inputSchema.behavior?.includes("bubble")
          ? null
          : result.inputSchema
      )
      .filter(Boolean) as Schema[];

    const inputSchema = combineSchemas(inputSchemas, (result, schema) => {
      if (schema.additionalProperties !== false) {
        result.additionalProperties = true;
      } else if (!("additionalProperties" in result)) {
        result.additionalProperties = false;
      }
    });
    const outputSchema = removeProperty(
      combineSchemas(outputSchemas),
      "schema"
    );

    return { inputSchema, outputSchema };
  }

  async #tryDescribingWithCustomDescriber(
    inputs: InputValues
  ): Promise<CustomDescriberResult> {
    const customDescriber =
      this.#graph.metadata?.describer ||
      (this.#graph.main ? `module:${this.#graph.main}` : undefined);
    if (!customDescriber) {
      return { success: false };
    }
    // invoke graph
    try {
      const { loader, sandbox } = this.#options;
      if (sandbox && customDescriber.startsWith("module:")) {
        const { inputSchema, outputSchema } =
          await this.#describeWithStaticAnalysis();

        const moduleId = customDescriber.slice("module:".length);

        const result = await invokeDescriber(
          moduleId,
          sandbox,
          this.#graph,
          inputs,
          inputSchema,
          outputSchema
        );
        if (result) {
          return { success: true, result };
        }
        if (result === false) {
          return { success: false };
        }
      }
      if (!loader) {
        return { success: false };
      }
      const base = this.#url;

      // try loading the describer graph.
      const loadResult = await loader.load(customDescriber, {
        base,
        board: this.#graph,
        outerGraph: this.#graph,
      });
      if (!loadResult.success) {
        const error = `Could not load custom describer graph ${customDescriber}: ${loadResult.error}`;
        console.warn(error);
        return loadResult;
      }
      const { inputSchema: $inputSchema, outputSchema: $outputSchema } =
        await this.#describeWithStaticAnalysis();
      // Remove the artifacts of the describer from the input/output schemas.
      // TODO: The right fix here is for static describer to not include
      // describer outputs.
      // delete $outputSchema.properties?.inputSchema;
      // delete $outputSchema.properties?.outputSchema;
      const result = (await invokeGraph(
        loadResult,
        { ...inputs, $inputSchema, $outputSchema },
        {
          base,
          kits: this.#options.kits,
          loader,
        }
      )) as NodeDescriberResult;
      if ("$error" in result) {
        console.warn(
          `Error while invoking graph's custom describer`,
          result.$error
        );
        return { success: false };
      }
      if (!result.inputSchema || !result.outputSchema) {
        console.warn(
          `Custom describer did not return input/output schemas`,
          result
        );
        return { success: false };
      }
      return { success: true, result };
    } catch (e) {
      console.warn(`Error while invoking graph's custom describer`, e);
      return { success: false };
    }
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    const result = await this.#tryDescribingWithCustomDescriber(inputs || {});
    if (result.success) {
      return result.result;
    }
    return this.#describeWithStaticAnalysis();
  }

  get nodeStore() {
    return this.#cache.nodes;
  }

  get edgeStore() {
    return this.#cache.edges;
  }

  get moduleStore() {
    return this.#cache.modules;
  }

  updateGraph(
    graph: GraphDescriptor,
    visualOnly: boolean,
    affectedNodes: NodeIdentifier[],
    affectedModules: ModuleIdentifier[]
  ): void {
    // TODO: Handle this a better way?
    for (const id of affectedModules) {
      this.#cache.modules.remove(id);
      if (!graph.modules || !graph.modules[id]) {
        continue;
      }

      this.#cache.modules.add(id, graph.modules[id]);

      // Find any nodes configured to use this module and clear its describer.
      const runModulesNodes = this.#cache.nodes.byType(
        "runModule",
        this.#graphId
      );
      for (const node of runModulesNodes) {
        if (
          node.configuration().$module &&
          node.configuration().$module === id &&
          !affectedNodes.includes(node.descriptor.id)
        ) {
          affectedNodes.push(node.descriptor.id);
          visualOnly = false;
        }
      }
    }

    this.#cache.describe.clear(visualOnly, affectedNodes);
    this.#graph = graph;
    this.#graphs = null;
  }

  resetGraph(graph: GraphDescriptor): void {
    if (this.#graphId) {
      throw new Error("Handling subgraphs isn't yet implemented.");
    }
    this.#graph = graph;
    const nodes = new NodeCache(this);
    const edges = new EdgeCache(nodes);
    edges.populate(graph);

    const modules = new ModuleCache();
    modules.populate(graph);

    const describe = new DescribeResultCache();

    this.#cache = { edges, nodes, modules, describe };
    this.#graphs = null;
  }

  addSubgraph(subgraph: GraphDescriptor, graphId: GraphIdentifier): void {
    if (this.#graphId) {
      throw new Error(
        `Can't add subgraph "${graphId}" to subgraph "${this.#graphId}": subgraphs can't contain subgraphs`
      );
    }
    this.#cache.nodes.addSubgraphNodes(subgraph, graphId);
    this.#cache.edges.addSubgraphEdges(subgraph, graphId);
  }

  removeSubgraph(graphId: GraphIdentifier): void {
    if (this.#graphId) {
      throw new Error(
        `Can't remove subgraph "${graphId}" from subgraph "${this.#graphId}": subgraphs can't contain subgraphs`
      );
    }
    this.#cache.nodes.removeSubgraphNodes(graphId);
    this.#cache.edges.removeSubgraphEdges(graphId);
  }

  #populateSubgraphs(): InspectableSubgraphs {
    const subgraphs = this.#graph.graphs;
    if (!subgraphs) return {};
    return Object.fromEntries(
      Object.keys(subgraphs).map((id) => {
        return [
          id,
          new Graph(
            this.#graph,
            id,
            this.#cache.nodes,
            this.#cache.edges,
            this.#options
          ),
        ];
      })
    );
  }

  graphs(): InspectableSubgraphs | undefined {
    if (this.#graphId) return;
    return (this.#graphs ??= this.#populateSubgraphs());
  }

  graphId(): GraphIdentifier {
    return this.#graphId;
  }
}
