/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlers } from "@google-labs/graph-runner";
import type {
  BreadboardNode,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
} from "@google-labs/breadboard";

import textAsset from "./nodes/text-asset.js";
import textAssetsFromPath from "./nodes/text-assets-from-path.js";
import create_vector_database from "./nodes/create-vector-database.js";
import add_to_vector_database from "./nodes/add-to-vector-database.js";
import query_vector_database from "./nodes/query-vector-database.js";
import embed_docs from "./nodes/embed-docs.js";
import embed_string from "./nodes/embed-string.js";
import cache from "./nodes/cache.js";

const handlers = {
  create_vector_database,
  add_to_vector_database,
  query_vector_database,
  embed_docs,
  embed_string,
  cache,
  "text-asset": textAsset,
  "text-assets-from-path": textAssetsFromPath,
};

/**
 * Syntactic sugar to easily create nodes.
 */
export class Nursery implements Kit {
  url = "npm:@google-labs/node-nursery";
  #nodeFactory: NodeFactory;
  #handlers: NodeHandlers;

  get handlers() {
    return this.#handlers;
  }

  constructor(nodeFactory: NodeFactory) {
    this.#nodeFactory = nodeFactory;
    this.#handlers = handlers;
  }

  createVectorDatabase(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("create_vector_database", { ...rest }, $id);
  }

  addToVectorDatabase(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("add_to_vector_database", { ...rest }, $id);
  }

  queryVectorDatabase(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("query_vector_database", { ...rest }, $id);
  }

  embedDocs(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("embed_docs", { ...rest }, $id);
  }

  embedString(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("embed_string", { ...rest }, $id);
  }

  textAsset(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("text-asset", { ...rest }, $id);
  }

  textAssetsFromPath(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("text-assets-from-path", { ...rest }, $id);
  }

  cache(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("cache", { ...rest }, $id);
  }
}
