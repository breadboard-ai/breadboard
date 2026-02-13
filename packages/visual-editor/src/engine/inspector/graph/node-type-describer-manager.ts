/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DescribeResultTypeCacheArgs,
  GraphDescriptor,
  GraphStoreArgs,
  MutableGraphStore,
  NodeDescriberContext,
  NodeDescriberFunction,
  NodeDescriberResult,
  NodeHandler,
  NodeHandlerContext,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import { createLoader } from "../../loader/index.js";
import { SENTINEL_BASE_URL } from "../../loader/loader.js";
import { getHandler } from "../../runtime/legacy.js";
import { UpdateEvent } from "./event.js";
import { emptyResult, NodeDescriberManager } from "./node-describer-manager.js";
import { describeInput, describeOutput } from "./schemas.js";
import {
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
} from "../../../data/file-system.js";

export { NodeTypeDescriberManager };

const PLACEHOLDER_ID = crypto.randomUUID();

const TYPE_DESCRIPTOR_GRAPH_URL = SENTINEL_BASE_URL.href;

class NodeTypeDescriberManager implements DescribeResultTypeCacheArgs {
  #deps: GraphStoreArgs;

  constructor(
    public readonly store: MutableGraphStore,
    deps: GraphStoreArgs
  ) {
    this.#deps = deps;
  }

  initial(): NodeDescriberResult {
    return emptyResult();
  }

  updated(): void {
    this.store.dispatchEvent(
      new UpdateEvent(PLACEHOLDER_ID, "", "", [], false)
    );
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

    const describer = await this.#getDescriber(type);
    const asWired = NodeDescriberManager.asWired();
    if (!describer) {
      return asWired;
    }
    const loader = this.#deps.loader || createLoader();
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
      sandbox: this.#deps.sandbox,
      graphStore: this.store,
      fileSystem: this.#deps.fileSystem.createRunFileSystem({
        graphUrl: TYPE_DESCRIPTOR_GRAPH_URL,
        env: envFromGraphDescriptor(this.#deps.fileSystem.env()),
        assets: assetsFromGraphDescriptor(),
      }),
      wires: { incoming: {}, outgoing: {} },
      asType: true,
      flags: this.#deps.flags,
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
    const context: NodeHandlerContext = {
      loader: this.#deps.loader,
      sandbox: this.#deps.sandbox,
      graphStore: this.store,
    };
    try {
      handler = await getHandler(type, context);
    } catch (e) {
      console.warn(`Error getting describer for node type ${type}`, e);
    }
    if (!handler || !("describe" in handler) || !handler.describe) {
      return undefined;
    }
    return handler.describe;
  }
}
