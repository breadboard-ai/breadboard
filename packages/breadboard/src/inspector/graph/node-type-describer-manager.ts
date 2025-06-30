/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createLoader, SENTINEL_BASE_URL } from "@breadboard-ai/loader";
import { getHandler } from "@breadboard-ai/runtime/legacy.js";
import type {
  DescribeResultTypeCacheArgs,
  GraphDescriptor,
  MutableGraphStore,
  NodeDescriberContext,
  NodeDescriberFunction,
  NodeDescriberResult,
  NodeHandler,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import {
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
} from "../../data/file-system/assets.js";
import { contextFromMutableGraphStore } from "../graph-store.js";
import { UpdateEvent } from "./event.js";
import { emptyResult, NodeDescriberManager } from "./node-describer-manager.js";
import { describeInput, describeOutput } from "./schemas.js";

export { NodeTypeDescriberManager };

const PLACEHOLDER_ID = crypto.randomUUID();

const TYPE_DESCRIPTOR_GRAPH_URL = SENTINEL_BASE_URL.href;

class NodeTypeDescriberManager implements DescribeResultTypeCacheArgs {
  constructor(public readonly store: MutableGraphStore) {}

  initial(): NodeDescriberResult {
    return emptyResult();
  }

  updated(): void {
    this.store.dispatchEvent(new UpdateEvent(PLACEHOLDER_ID, "", "", []));
  }

  latest(type: NodeTypeIdentifier): Promise<NodeDescriberResult> {
    return this.getLatestDescription(type);
  }

  async getLatestDescription(type: NodeTypeIdentifier) {
    // The schema of an input or an output is defined by their
    // configuration schema or their incoming/outgoing edges.
    if (type === "input") {
      return describeInput({});
    }
    if (type === "output") {
      return describeOutput({});
    }

    const kits = [...this.store.kits];
    const describer = await this.#getDescriber(type);
    const asWired = NodeDescriberManager.asWired();
    if (!describer) {
      return asWired;
    }
    const loader = this.store.loader || createLoader();
    // When describing types, we provide a weird empty graph with a special URL
    // because we're not actually inside of any graph, and that is ok.
    const outerGraph: GraphDescriptor = {
      nodes: [],
      edges: [],
      url: TYPE_DESCRIPTOR_GRAPH_URL,
    };
    const context: NodeDescriberContext = {
      outerGraph,
      loader,
      kits,
      sandbox: this.store.sandbox,
      graphStore: this.store,
      fileSystem: this.store.fileSystem.createRunFileSystem({
        graphUrl: TYPE_DESCRIPTOR_GRAPH_URL,
        env: envFromGraphDescriptor(this.store.fileSystem.env()),
        assets: assetsFromGraphDescriptor(),
      }),
      wires: { incoming: {}, outgoing: {} },
      asType: true,
    };
    try {
      return describer(
        undefined,
        asWired.inputSchema,
        asWired.outputSchema,
        context
      );
    } catch (e) {
      console.warn(`Error describing node type ${type}`, e);
      return asWired;
    }
  }

  async #getDescriber(
    type: NodeTypeIdentifier
  ): Promise<NodeDescriberFunction | undefined> {
    let handler: NodeHandler | undefined;
    try {
      handler = await getHandler(
        type,
        contextFromMutableGraphStore(this.store)
      );
    } catch (e) {
      console.warn(`Error getting describer for node type ${type}`, e);
    }
    if (!handler || !("describe" in handler) || !handler.describe) {
      return undefined;
    }
    return handler.describe;
  }
}
