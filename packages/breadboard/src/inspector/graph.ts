/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphMetadata,
  InputValues,
  StartLabel,
} from "@google-labs/breadboard-schema/graph.js";
import { getHandler } from "../handler.js";
import { createLoader } from "../loader/index.js";
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
import { EdgeCache } from "./edge.js";
import { collectKits, createGraphNodeType } from "./kits.js";
import { NodeCache } from "./node.js";
import {
  EdgeType,
  describeInput,
  describeOutput,
  edgesToSchema,
} from "./schemas.js";
import {
  InspectableEdge,
  MutableGraph,
  InspectableGraphOptions,
  InspectableGraphWithStore,
  InspectableKit,
  InspectableNode,
  InspectableSubgraphs,
  NodeTypeDescriberOptions,
  InspectableNodeType,
} from "./types.js";
import { invokeGraph } from "../run/invoke-graph.js";
import { graphUrlLike } from "../utils/graph-url-like.js";

export const inspectableGraph = (
  graph: GraphDescriptor,
  options?: InspectableGraphOptions
): InspectableGraphWithStore => {
  return new Graph(graph, options);
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
  #cache: MutableGraph;
  #graphs: InspectableSubgraphs | null = null;

  constructor(graph: GraphDescriptor, options?: InspectableGraphOptions) {
    this.#graph = graph;
    this.#url = maybeURL(graph.url);
    this.#options = options || {};
    const nodes = new NodeCache(this);
    const edges = new EdgeCache(nodes);
    edges.populate(graph);
    this.#cache = { edges, nodes };
  }

  raw() {
    return this.#graph;
  }

  metadata(): GraphMetadata | undefined {
    return this.#graph.metadata;
  }

  nodesByType(type: NodeTypeIdentifier): InspectableNode[] {
    return this.#cache.nodes.byType(type);
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

  async describeType(
    type: NodeTypeIdentifier,
    options: NodeTypeDescriberOptions = {}
  ): Promise<NodeDescriberResult> {
    // The schema of an input or an output is defined by their
    // configuration schema or their incoming/outgoing edges.
    if (type === "input") {
      return describeInput(options);
    }
    if (type === "output") {
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
      outerGraph: this.#graph,
      loader,
      kits,
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
  }

  nodeById(id: NodeIdentifier) {
    return this.#cache.nodes.get(id);
  }

  nodes(): InspectableNode[] {
    return this.#cache.nodes.nodes();
  }

  edges(): InspectableEdge[] {
    return this.#cache.edges.edges();
  }

  hasEdge(edge: Edge): boolean {
    return this.#cache.edges.hasByValue(edge);
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
      .map((edge) => this.#cache.edges.getOrCreate(edge));
  }

  outgoingForNode(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph.edges
      .filter((edge) => edge.from === id)
      .map((edge) => this.#cache.edges.getOrCreate(edge));
  }

  entries(label?: StartLabel): InspectableNode[] {
    return this.#cache.nodes.nodes().filter((node) => node.isEntry(label));
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
    const customDescriber = this.#graph.metadata?.describer;
    if (!customDescriber) {
      return { success: false };
    }
    // invoke graph
    try {
      const base = this.#url;
      // try loading the describer graph.
      const { loader } = this.#options;
      if (!loader) {
        return { success: false };
      }
      const describerGraph = await loader.load(customDescriber, {
        base,
        board: this.#graph,
        outerGraph: this.#graph,
      });
      if (!describerGraph) {
        console.warn(
          `Could not load custom describer graph ${customDescriber}`
        );
        return { success: false };
      }
      const { inputSchema: $inputSchema, outputSchema: $outputSchema } =
        await this.#describeWithStaticAnalysis();
      // Remove the artifacts of the describer from the input/output schemas.
      // TODO: The right fix here is for static describer to not include
      // describer outputs.
      // delete $outputSchema.properties?.inputSchema;
      // delete $outputSchema.properties?.outputSchema;
      const result = (await invokeGraph(
        describerGraph,
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

  updateGraph(graph: GraphDescriptor): void {
    this.#graph = graph;
  }

  resetGraph(graph: GraphDescriptor): void {
    this.#graph = graph;
    const nodes = new NodeCache(this);
    const edges = new EdgeCache(nodes);
    edges.populate(graph);
    this.#cache = { edges, nodes };
    this.#graphs = null;
  }

  #populateSubgraphs(): InspectableSubgraphs {
    const subgraphs = this.#graph.graphs;
    if (!subgraphs) return {};
    return Object.fromEntries(
      Object.entries(subgraphs).map(([id, descriptor]) => {
        return [id, new Graph(descriptor, this.#options)];
      })
    );
  }

  graphs(): InspectableSubgraphs {
    return (this.#graphs ??= this.#populateSubgraphs());
  }
}
