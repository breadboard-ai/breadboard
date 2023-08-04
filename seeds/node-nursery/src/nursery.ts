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

import vars from "./nodes/vars.js";
import textAsset from "./nodes/text-asset.js";
import textAssetsFromPath from "./nodes/text-assets-from-path.js";
import createVectorDatabase from "./nodes/create-vector-database.js";
import addToVectorDatabase from "./nodes/add-to-vector-database.js";
import queryVectorDatabase from "./nodes/query-vector-database.js";
import embedDocs from "./nodes/embed-docs.js";
import embedString from "./nodes/embed-string.js";
import cache from "./nodes/cache.js";

const handlers = {
  createVectorDatabase,
  addToVectorDatabase,
  queryVectorDatabase,
  embedDocs,
  embedString,
  cache,
  textAsset,
  textAssetsFromPath,
  vars,
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
    return this.#nodeFactory("createVectorDatabase", { ...rest }, $id);
  }

  addToVectorDatabase(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("addToVectorDatabase", { ...rest }, $id);
  }

  queryVectorDatabase(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("queryVectorDatabase", { ...rest }, $id);
  }

  embedDocs(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("embedDocs", { ...rest }, $id);
  }

  embedString(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("embedString", { ...rest }, $id);
  }

  textAsset(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("textAsset", { ...rest }, $id);
  }

  textAssetsFromPath(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("textAssetsFromPath", { ...rest }, $id);
  }

  cache(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("cache", { ...rest }, $id);
  }
}
