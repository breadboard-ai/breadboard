/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier, NodeTypeIdentifier } from "@breadboard-ai/types";
import {
  InspectableDescriberResultCache,
  InspectableGraphOptions,
  NodeTypeDescriberOptions,
} from "./types.js";
import {
  NodeDescriberContext,
  NodeDescriberFunction,
  NodeDescriberResult,
  NodeHandler,
} from "../types.js";
import {
  describeInput,
  describeOutput,
  edgesToSchema,
  EdgeType,
} from "./schemas.js";
import { invokeMainDescriber } from "../sandboxed-run-module.js";
import { createLoader } from "../loader/index.js";
import { getHandler } from "../handler.js";
import { GraphDescriptorHandle } from "./graph-descriptor-handle.js";

export { DescriberManager };

/**
 * Contains all machinery that allows
 * describing a node or a graph
 */
class DescriberManager {
  constructor(
    public readonly handle: GraphDescriptorHandle,
    public readonly cache: InspectableDescriberResultCache,
    public readonly options: InspectableGraphOptions
  ) {}

  async #getDescriber(
    type: NodeTypeIdentifier
  ): Promise<NodeDescriberFunction | undefined> {
    const { kits } = this.options;
    const loader = this.options.loader || createLoader();
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
    return this.cache.getOrCreate(id, this.handle.graphId, async () => {
      // The schema of an input or an output is defined by their
      // configuration schema or their incoming/outgoing edges.
      if (type === "input") {
        if (this.handle.main()) {
          if (!this.options.sandbox) {
            throw new Error(
              "Sandbox not supplied, won't be able to describe this graph correctly"
            );
          }
          const result = await invokeMainDescriber(
            this.options.sandbox,
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
          if (!this.options.sandbox) {
            throw new Error(
              "Sandbox not supplied, won't be able to describe this graph correctly"
            );
          }
          const result = await invokeMainDescriber(
            this.options.sandbox,
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

      const { kits } = this.options;
      const describer = await this.#getDescriber(type);
      const asWired = {
        inputSchema: edgesToSchema(EdgeType.In, options?.incoming),
        outputSchema: edgesToSchema(EdgeType.Out, options?.outgoing),
      } satisfies NodeDescriberResult;
      if (!describer) {
        return asWired;
      }
      const loader = this.options.loader || createLoader();
      const context: NodeDescriberContext = {
        outerGraph: this.handle.outerGraph(),
        loader,
        kits,
        sandbox: this.options.sandbox,
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
    });
  }
}
