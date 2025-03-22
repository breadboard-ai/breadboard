/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  InputValues,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import { InspectableNode, MutableGraph } from "../types.js";
import { GraphDescriptorHandle } from "./graph-descriptor-handle.js";
import { NodeDescriberResult, Schema } from "../../types.js";
import { describeInput, describeOutput } from "./schemas.js";
import { combineSchemas, removeProperty } from "../../schema.js";
import {
  invokeDescriber,
  invokeMainDescriber,
} from "../../sandboxed-run-module.js";
import { invokeGraph } from "../../run/invoke-graph.js";
import { ParameterManager } from "../../run/parameter-manager.js";
import { Outcome } from "../../data/types.js";
import { err, ok } from "../../data/file-system/utils.js";

export { GraphDescriberManager };

/**
 * Contains all machinery that allows
 * describing a node or a graph
 */
class GraphDescriberManager {
  private readonly params: ParameterManager;

  private constructor(
    public readonly handle: GraphDescriptorHandle,
    public readonly mutable: MutableGraph
  ) {
    this.params = new ParameterManager(handle.graph());
  }

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

    return this.#presumeContextInOut({ inputSchema, outputSchema });
  }

  /**
   * This is a bit hacky, but it gets the job done.
   * This function tweaks the result to look like a context in / context out
   * in cases when the graph being described is a subgraph and the
   * static analysis yielded nothing.
   *
   * Additionally, we scan for parameters in the graph and add them as schema
   * parameters.
   *
   * We use this logic to allow subgraphs that are "custom tools" to
   * participate as normal steps in the graph.
   */
  #presumeContextInOut(result: NodeDescriberResult): NodeDescriberResult {
    const { inputSchema, outputSchema } = result;
    if (
      !inputSchema.properties &&
      !outputSchema.properties &&
      this.handle.graphId
    ) {
      return filterEmptyValues({
        ...result,
        inputSchema: {
          properties: {
            context: {
              type: "array",
              items: { type: "object", behavior: ["llm-content"] },
            },
            ...this.params.propertiesSchema(),
          },
        },
        outputSchema: {
          properties: {
            context: {
              type: "array",
              items: { type: "object", behavior: ["llm-content"] },
            },
          },
        },
      });
    }
    return result;
  }

  async #tryDescribingWithCustomDescriber(
    inputs: InputValues
  ): Promise<Outcome<NodeDescriberResult>> {
    const customDescriber =
      this.handle.graph().metadata?.describer ||
      (this.handle.graph().main
        ? `module:${this.handle.graph().main}`
        : undefined);
    if (!customDescriber) {
      return err("Unable to find custom describer");
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
            this.mutable,
            this.mutable.graph,
            inputs,
            inputSchema,
            outputSchema
          );
        } else {
          result = await invokeDescriber(
            moduleId,
            this.mutable,
            this.mutable.graph,
            inputs,
            inputSchema,
            outputSchema
          );
        }
        if (result) {
          return result;
        }
        if (result === false) {
          return err("Custom describer could not provide results.");
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
        return err(error);
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
        return err(`${message}: ${JSON.stringify(result.$error)}`);
      }
      if (!result.inputSchema || !result.outputSchema) {
        const message = `Custom describer did not return input/output schemas`;
        console.warn(message, result);
        return err(`${message}: ${JSON.stringify(result)}`);
      }
      return result;
    } catch (e) {
      const message = `Error while invoking graph's custom describer`;
      console.warn(message, e);
      return err(`${message}: ${JSON.stringify(e)}`);
    }
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    const result = await this.#tryDescribingWithCustomDescriber(inputs || {});
    if (ok(result)) {
      return result;
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
  ): Outcome<GraphDescriberManager> {
    const handle = GraphDescriptorHandle.create(cache.graph, graphId);
    if (!handle.success) {
      return err(handle.error);
    }
    return new GraphDescriberManager(handle.result, cache);
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
