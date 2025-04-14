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
  MutableGraph,
  NodeTypeDescriberOptions,
} from "../types.js";
import {
  NodeDescriberContext,
  NodeDescriberFunction,
  NodeDescriberResult,
  NodeHandler,
} from "../../types.js";
import {
  describeInput,
  describeOutput,
  edgesToSchema,
  EdgeType,
} from "./schemas.js";
import { createLoader } from "../../loader/index.js";
import { getHandler } from "../../handler.js";
import { GraphDescriptorHandle } from "./graph-descriptor-handle.js";
import { contextFromMutableGraph } from "../graph-store.js";
import { SchemaDiffer } from "../../utils/schema-differ.js";
import { UpdateEvent } from "./event.js";
import { invokeMainDescriber } from "../../sandbox/invoke-describer.js";
import { assetsFromGraphDescriptor } from "../../data/index.js";
import { envFromGraphDescriptor } from "../../data/file-system/assets.js";

export { NodeTypeDescriberManager };

function emptyResult(): NodeDescriberResult {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  };
}

class NodeTypeDescriberManager implements DescribeResultCacheArgs {
  public constructor(public readonly mutable: MutableGraph) {}

  initialType(): NodeDescriberResult {
    return emptyResult();
  }

  updatedType(): void {
    this.mutable.store.dispatchEvent(
      new UpdateEvent(this.mutable.id, "", "", [])
    );
  }

  latestType(type: NodeTypeIdentifier): Promise<NodeDescriberResult> {
    return this.getLatestDescription(type, "");
  }

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

    if (
      inputsDiffer.same() &&
      outputsDiffer.same() &&
      sameMetadata(previous, current)
    ) {
      return;
    }
  }

  updated(graphId: GraphIdentifier, nodeId: NodeIdentifier): void {
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
          this.mutable,
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
          this.mutable,
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
      fileSystem: this.mutable.store.fileSystem.createRunFileSystem({
        graphUrl: handle.outerGraph().url!,
        env: envFromGraphDescriptor(
          this.mutable.store.fileSystem.env(),
          handle.outerGraph()
        ),
        assets: assetsFromGraphDescriptor(handle.outerGraph()),
      }),
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

function sameMetadata(a: NodeDescriberResult, b: NodeDescriberResult) {
  if (a.title !== b.title) return false;
  if (a.description !== b.description) return false;
  if (a.metadata?.icon !== b.metadata?.icon) return false;
  // TODO: Compare tags and help.
  return true;
}
