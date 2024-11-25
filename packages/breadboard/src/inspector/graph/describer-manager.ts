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

export { DescriberManager };

/**
 * Contains all machinery that allows
 * describing a node or a graph
 */
class DescriberManager {
  private constructor(
    public readonly handle: GraphDescriptorHandle,
    public readonly cache: MutableGraph
  ) {}

  async #getDescriber(
    type: NodeTypeIdentifier
  ): Promise<NodeDescriberFunction | undefined> {
    const { kits } = this.cache.options;
    const loader = this.cache.options.loader || createLoader();
    let handler: NodeHandler | undefined;
    try {
      handler = await getHandler(type, { kits, loader });
    } catch (e) {
      console.warn(`Error getting describer for node type ${type}`, e);
    }
    if (!handler || !("describe" in handler) || !handler.describe) {
      return undefined;
    }
    return handler.describe;
  }

  #nodesByType(type: NodeTypeIdentifier): InspectableNode[] {
    return this.cache.nodes.byType(type, this.handle.graphId);
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
      const { loader, sandbox } = this.cache.options;
      if (sandbox && customDescriber.startsWith("module:")) {
        const { inputSchema, outputSchema } =
          await this.#describeWithStaticAnalysis();

        const moduleId = customDescriber.slice("module:".length);

        const result = await invokeDescriber(
          moduleId,
          sandbox,
          this.handle.graph(),
          inputs,
          inputSchema,
          outputSchema
        );
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
      if (!loader) {
        return {
          success: false,
          error:
            "Unable to proceed with custom describer graph: no loader supplied.",
        };
      }
      const base = this.handle.url();

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
          kits: this.cache.options.kits,
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
    return this.#describeWithStaticAnalysis();
  }

  async describeNodeType(
    id: NodeIdentifier,
    type: NodeTypeIdentifier,
    options: NodeTypeDescriberOptions = {}
  ): Promise<NodeDescriberResult> {
    return this.cache.describe.getOrCreate(
      id,
      this.handle.graphId,
      async () => {
        // The schema of an input or an output is defined by their
        // configuration schema or their incoming/outgoing edges.
        if (type === "input") {
          if (this.handle.main()) {
            if (!this.cache.options.sandbox) {
              throw new Error(
                "Sandbox not supplied, won't be able to describe this graph correctly"
              );
            }
            const result = await invokeMainDescriber(
              this.cache.options.sandbox,
              this.handle.graph(),
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
          if (this.handle.main()) {
            if (!this.cache.options.sandbox) {
              throw new Error(
                "Sandbox not supplied, won't be able to describe this graph correctly"
              );
            }
            const result = await invokeMainDescriber(
              this.cache.options.sandbox,
              this.handle.graph(),
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

        const { kits } = this.cache.options;
        const describer = await this.#getDescriber(type);
        const asWired = {
          inputSchema: edgesToSchema(EdgeType.In, options?.incoming),
          outputSchema: edgesToSchema(EdgeType.Out, options?.outgoing),
        } satisfies NodeDescriberResult;
        if (!describer) {
          return asWired;
        }
        const loader = this.cache.options.loader || createLoader();
        const context: NodeDescriberContext = {
          outerGraph: this.handle.outerGraph(),
          loader,
          kits,
          sandbox: this.cache.options.sandbox,
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
        if (this.handle.url()) {
          context.base = this.handle.url();
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
    );
  }

  static create(
    graphId: GraphIdentifier,
    cache: MutableGraph
  ): Result<DescriberManager> {
    const handle = GraphDescriptorHandle.create(cache.graph, graphId);
    if (!handle.success) {
      return handle;
    }
    return {
      success: true,
      result: new DescriberManager(handle.result, cache),
    };
  }
}
