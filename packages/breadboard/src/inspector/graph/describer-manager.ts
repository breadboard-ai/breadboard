/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  InputValues,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import {
  DescribeResultCacheArgs,
  InspectableEdge,
  InspectableNode,
  MutableGraph,
  NodeTypeDescriberOptions,
} from "../types.js";
import {
  NodeDescriberContext,
  NodeDescriberFunction,
  NodeDescriberResult,
  NodeHandler,
  Schema,
} from "../../types.js";
import {
  describeInput,
  describeOutput,
  edgesToSchema,
  EdgeType,
} from "./schemas.js";
import {
  invokeDescriber,
  invokeMainDescriber,
} from "../../sandboxed-run-module.js";
import { createLoader } from "../../loader/index.js";
import { getHandler } from "../../handler.js";
import { GraphDescriptorHandle } from "./graph-descriptor-handle.js";
import { combineSchemas, removeProperty } from "../../schema.js";
import { Result } from "../../editor/types.js";
import { invokeGraph } from "../../run/invoke-graph.js";
import { contextFromMutableGraph } from "../graph-store.js";
import { SchemaDiffer } from "../../utils/schema-differ.js";
import { UpdateEvent } from "./event.js";

export { GraphDescriberManager, NodeTypeDescriberManager };

function emptyResult(): NodeDescriberResult {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  };
}

class NodeTypeDescriberManager implements DescribeResultCacheArgs {
  public constructor(public readonly mutable: MutableGraph) {}

  initial(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ): NodeDescriberResult {
    const node = this.mutable.nodes.get(nodeId, graphId);
    if (!node) {
      return emptyResult();
    }
    return NodeTypeDescriberManager.asWired(node.incoming(), node.outgoing());
  }

  async latest(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier,
    inputs?: InputValues
  ): Promise<NodeDescriberResult> {
    const node = this.mutable.nodes.get(nodeId, graphId);
    if (!node) {
      return emptyResult();
    }
    return this.getLatestDescription(node.descriptor.type, graphId, {
      incoming: node.incoming(),
      outgoing: node.outgoing(),
      inputs: { ...node.configuration(), ...inputs },
    });
  }

  willUpdate(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier,
    previous: NodeDescriberResult,
    current: NodeDescriberResult
  ): void {
    const inputsDiffer = new SchemaDiffer(
      previous.inputSchema,
      current.inputSchema
    );
    inputsDiffer.computeDiff();

    const outputsDiffer = new SchemaDiffer(
      previous.outputSchema,
      current.outputSchema
    );
    outputsDiffer.computeDiff();

    if (inputsDiffer.same() && outputsDiffer.same()) {
      return;
    }
    this.mutable.store.dispatchEvent(
      new UpdateEvent(this.mutable.id, graphId, nodeId, [])
    );
  }

  async #getDescriber(
    type: NodeTypeIdentifier
  ): Promise<NodeDescriberFunction | undefined> {
    let handler: NodeHandler | undefined;
    try {
      handler = await getHandler(type, contextFromMutableGraph(this.mutable));
    } catch (e) {
      console.warn(`Error getting describer for node type ${type}`, e);
    }
    if (!handler || !("describe" in handler) || !handler.describe) {
      return undefined;
    }
    return handler.describe;
  }

  async getLatestDescription(
    type: NodeTypeIdentifier,
    graphId: GraphIdentifier,
    options: NodeTypeDescriberOptions = {}
  ) {
    const gettingHandle = GraphDescriptorHandle.create(
      this.mutable.graph,
      graphId
    );
    if (!gettingHandle.success) {
      throw new Error(gettingHandle.error);
    }
    const handle = gettingHandle.result;
    // The schema of an input or an output is defined by their
    // configuration schema or their incoming/outgoing edges.
    if (type === "input") {
      if (handle.main()) {
        if (!this.mutable.store.sandbox) {
          throw new Error(
            "Sandbox not supplied, won't be able to describe this graph correctly"
          );
        }
        const result = await invokeMainDescriber(
          this.mutable.store.sandbox,
          handle.graph(),
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
      if (handle.main()) {
        if (!this.mutable.store.sandbox) {
          throw new Error(
            "Sandbox not supplied, won't be able to describe this graph correctly"
          );
        }
        const result = await invokeMainDescriber(
          this.mutable.store.sandbox,
          handle.graph(),
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

    const kits = [...this.mutable.store.kits];
    const describer = await this.#getDescriber(type);
    const asWired = NodeTypeDescriberManager.asWired(
      options.incoming,
      options.outgoing
    );
    if (!describer) {
      return asWired;
    }
    const loader = this.mutable.store.loader || createLoader();
    const context: NodeDescriberContext = {
      outerGraph: handle.outerGraph(),
      loader,
      kits,
      sandbox: this.mutable.store.sandbox,
      graphStore: this.mutable.store,
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
    if (handle.url()) {
      context.base = handle.url();
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

  static asWired(
    incoming: InspectableEdge[] = [],
    outgoing: InspectableEdge[] = []
  ) {
    return {
      inputSchema: edgesToSchema(EdgeType.In, incoming),
      outputSchema: edgesToSchema(EdgeType.Out, outgoing),
    } satisfies NodeDescriberResult;
  }
}

/**
 * Contains all machinery that allows
 * describing a node or a graph
 */
class GraphDescriberManager {
  private constructor(
    public readonly handle: GraphDescriptorHandle,
    public readonly mutable: MutableGraph
  ) {}

  #nodesByType(type: NodeTypeIdentifier): InspectableNode[] {
    return this.mutable.nodes.byType(type, this.handle.graphId);
  }

  async #describeWithStaticAnalysis(): Promise<NodeDescriberResult> {
    const inputSchemas = (
      await Promise.all(
        this.#nodesByType("input")
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
        this.#nodesByType("output")
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
  ): Promise<Result<NodeDescriberResult>> {
    const customDescriber =
      this.handle.graph().metadata?.describer ||
      (this.handle.graph().main
        ? `module:${this.handle.graph().main}`
        : undefined);
    if (!customDescriber) {
      return { success: false, error: "Unable to find custom describer" };
    }
    // invoke graph
    try {
      const { sandbox } = this.mutable.store;
      if (sandbox && customDescriber.startsWith("module:")) {
        const { inputSchema, outputSchema } =
          await this.#describeWithStaticAnalysis();

        const moduleId = customDescriber.slice("module:".length);

        let result;
        if (this.handle.main() === moduleId) {
          result = await invokeMainDescriber(
            sandbox,
            this.handle.graph(),
            inputs,
            inputSchema,
            outputSchema
          );
        } else {
          result = await invokeDescriber(
            moduleId,
            sandbox,
            this.handle.graph(),
            inputs,
            inputSchema,
            outputSchema
          );
        }
        if (result) {
          return { success: true, result };
        }
        if (result === false) {
          return {
            success: false,
            error: "Custom describer could not provide results.",
          };
        }
      }
      const base = this.handle.url();

      const loader = this.mutable.store.loader;

      // try loading the describer graph.
      const loadResult = await loader.load(customDescriber, {
        base,
        board: this.handle.graph(),
        outerGraph: this.handle.graph(),
      });
      if (!loadResult.success) {
        const error = `Could not load custom describer graph ${customDescriber}: ${loadResult.error}`;
        console.warn(error);
        return { success: false, error };
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
          kits: [...this.mutable.store.kits],
          loader,
        }
      )) as NodeDescriberResult;
      if ("$error" in result) {
        const message = `Error while invoking graph's custom describer`;
        console.warn(message, result.$error);
        return {
          success: false,
          error: `${message}: ${JSON.stringify(result.$error)}`,
        };
      }
      if (!result.inputSchema || !result.outputSchema) {
        const message = `Custom describer did not return input/output schemas`;
        console.warn(message, result);
        return {
          success: false,
          error: `${message}: ${JSON.stringify(result)}`,
        };
      }
      return { success: true, result };
    } catch (e) {
      const message = `Error while invoking graph's custom describer`;
      console.warn(message, e);
      return { success: false, error: `${message}: ${JSON.stringify(e)}` };
    }
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    const result = await this.#tryDescribingWithCustomDescriber(inputs || {});
    if (result.success) {
      return result.result;
    }
    const staticResult = await this.#describeWithStaticAnalysis();
    const graph = this.handle.graph();
    const metadata: Omit<NodeDescriberResult, "inputSchema" | "outputSchema"> =
      filterEmptyValues({
        title: graph.title,
        description: graph.description,
        metadata: filterEmptyValues({
          icon: graph.metadata?.icon,
          help: graph.metadata?.help,
          tags: graph.metadata?.tags,
        }),
      });
    return {
      ...metadata,
      ...staticResult,
    };
  }

  static create(
    graphId: GraphIdentifier,
    cache: MutableGraph
  ): Result<GraphDescriberManager> {
    const handle = GraphDescriptorHandle.create(cache.graph, graphId);
    if (!handle.success) {
      return handle;
    }
    return {
      success: true,
      result: new GraphDescriberManager(handle.result, cache),
    };
  }
}

/**
 * A utility function to filter out empty (null or undefined) values from
 * an object.
 *
 * @param obj -- The object to filter.
 * @returns -- The object with empty values removed.
 */
function filterEmptyValues<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      if (!value) return false;
      if (typeof value === "object") {
        return Object.keys(value).length > 0;
      }
      return true;
    })
  ) as T;
}
