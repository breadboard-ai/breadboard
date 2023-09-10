/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeHandlers,
  OutputValues,
} from "@google-labs/graph-runner";
import type {
  BreadboardNode,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
} from "@google-labs/breadboard";

import vars from "./nodes/vars.js";
import localMemory from "./nodes/local-memory.js";
import textAsset from "./nodes/text-asset.js";
import textAssetsFromPath from "./nodes/text-assets-from-path.js";
import createVectorDatabase from "./nodes/create-vector-database.js";
import addToVectorDatabase from "./nodes/add-to-vector-database.js";
import queryVectorDatabase from "./nodes/query-vector-database.js";
import embedDocs from "./nodes/embed-docs.js";
import embedString from "./nodes/embed-string.js";
import cache from "./nodes/cache.js";
import validateJson, {
  ValidateJsonInputs,
  ValidateJsonOutputs,
} from "./nodes/validate-json.js";
import schemish, { SchemishInputs, SchemishOutputs } from "./nodes/schemish.js";
import templateParser, {
  TemplateParserInputs,
  TemplateParserOutputs,
} from "./nodes/template-parser.js";

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
  localMemory,
  validateJson,
  schemish,
  templateParser,
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

  createVectorDatabase(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("createVectorDatabase", { ...rest }, $id);
  }

  addToVectorDatabase(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("addToVectorDatabase", { ...rest }, $id);
  }

  queryVectorDatabase(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("queryVectorDatabase", { ...rest }, $id);
  }

  embedDocs(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("embedDocs", { ...rest }, $id);
  }

  embedString(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("embedString", { ...rest }, $id);
  }

  textAsset(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("textAsset", { ...rest }, $id);
  }

  textAssetsFromPath(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("textAssetsFromPath", { ...rest }, $id);
  }

  cache(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("cache", { ...rest }, $id);
  }

  localMemory(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("localMemory", { ...rest }, $id);
  }

  validateJson(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create<ValidateJsonInputs, ValidateJsonOutputs>(
      "validateJson",
      { ...rest },
      $id
    );
  }

  schemish(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    const node = this.#nodeFactory.create<SchemishInputs, SchemishOutputs>(
      "schemish",
      { ...rest },
      $id
    );
    return node;
  }

  /**
   * Parses a template and returns a JSON schema of placeholders.
   */
  templateParser(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const { $id, ...rest } = config;
    const node = this.#nodeFactory.create<
      TemplateParserInputs,
      TemplateParserOutputs
    >("templateParser", { ...rest }, $id);
    return node;
  }
}
