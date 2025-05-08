/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describerResultToNodeHandlerMetadata } from "../../graph-based-node-handler.js";
import { getGraphHandlerFromMutableGraph } from "../../handler.js";
import {
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriberWires,
  NodeHandler,
  NodeHandlerMetadata,
  NodeHandlerObject,
} from "../../types.js";
import {
  InspectableNodePorts,
  InspectableNodeType,
  MutableGraph,
} from "../types.js";
import { portsFromHandler } from "./ports.js";

export { GraphNodeType };

class GraphNodeType implements InspectableNodeType {
  #type: string;
  #metadata: NodeHandlerMetadata | null = null;
  #handlerPromise: Promise<NodeHandlerObject | undefined> | null = null;
  #mutable: MutableGraph;

  constructor(type: string, mutable: MutableGraph) {
    this.#type = type;
    this.#mutable = mutable;
    this.#handlerPromise = getGraphHandlerFromMutableGraph(type, mutable);
  }

  #extractExamples(
    describeResult: NodeDescriberResult
  ): NodeConfiguration | undefined {
    const example = describeResult.inputSchema.examples?.at(0);
    if (!example) return;
    try {
      return JSON.parse(example) as NodeConfiguration;
    } catch (e) {
      // eat the error.
    }
  }

  async #readMetadata() {
    const handler = await this.#handlerPromise;
    const describeResult = await handler?.describe?.(
      undefined,
      undefined,
      undefined,
      {
        graphStore: this.#mutable.store,
        outerGraph: this.#mutable.graph,
        kits: [...this.#mutable.store.kits],
        wires: {} as NodeDescriberWires,
        fileSystem: this.#mutable.store.fileSystem,
      }
    );
    if (
      describeResult &&
      describeResult.metadata &&
      Object.keys(describeResult.metadata).length > 0
    ) {
      const example = this.#extractExamples(describeResult);
      return {
        ...describeResult.metadata,
        example,
        title: describeResult.title,
        description: describeResult.description,
      };
    }
    if (handler && "metadata" in handler && handler.metadata) {
      return handler.metadata;
    }
    return {
      title: shortUrlTitle(this.#type),
    };
  }

  currentMetadata(): NodeHandlerMetadata {
    const { current, updating } = this.#mutable.describe.getByType(this.#type);
    const result = describerResultToNodeHandlerMetadata(current, updating);
    return result;
  }

  async metadata(): Promise<NodeHandlerMetadata> {
    this.#metadata ??= await this.#readMetadata();
    return this.#metadata;
  }

  type() {
    return this.#type;
  }

  async ports(): Promise<InspectableNodePorts> {
    const handler = await this.#handlerPromise;
    return portsFromHandler(this.#type, handler as NodeHandler);
  }
}

function shortUrlTitle(url: string) {
  const urlObj = new URL(url);
  const path = urlObj.pathname.split("/").pop();
  return path || urlObj.host;
}
