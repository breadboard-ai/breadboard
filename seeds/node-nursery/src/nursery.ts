/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeTypeIdentifier,
  InputValues,
  NodeHandlers,
  OutputValues,
} from "@google-labs/graph-runner";
import type {
  BreadboardNode,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
  ConfigOrLambda,
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
import map, { MapInputs, MapOutputs } from "./nodes/map.js";
import batcher, { BatcherInputs, BatcherOutputs } from "./nodes/batcher.js";

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
  map,
  batcher,
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

  #create<Inputs, Outputs>(
    type: NodeTypeIdentifier,
    config: OptionalIdConfiguration
  ): BreadboardNode<Inputs, Outputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create(this, type, rest, $id);
  }

  createVectorDatabase(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create("createVectorDatabase", config);
  }

  addToVectorDatabase(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create("addToVectorDatabase", config);
  }

  queryVectorDatabase(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create("queryVectorDatabase", config);
  }

  embedDocs(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create("embedDocs", config);
  }

  embedString(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create("embedString", config);
  }

  textAsset(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create("textAsset", config);
  }

  textAssetsFromPath(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create("textAssetsFromPath", config);
  }

  cache(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create("cache", config);
  }

  localMemory(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create("localMemory", config);
  }

  validateJson(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    return this.#create<ValidateJsonInputs, ValidateJsonOutputs>(
      "validateJson",
      config
    );
  }

  schemish(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const node = this.#create<SchemishInputs, SchemishOutputs>(
      "schemish",
      config
    );
    return node;
  }

  /**
   * Parses a template and returns a JSON schema of placeholders.
   */
  templateParser(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<InputValues, OutputValues> {
    const node = this.#create<TemplateParserInputs, TemplateParserOutputs>(
      "templateParser",
      config
    );
    return node;
  }

  /**
   * Work in progress implementation of a `map` node as part of work on
   * issue #110.
   * @param config
   * @returns
   */
  map<In = InputValues, Out = OutputValues>(
    config: ConfigOrLambda<In, Out> = {}
  ): BreadboardNode<MapInputs, MapOutputs> {
    // Create the node.
    const node = this.#create<MapInputs, MapOutputs>(
      "map",
      this.#nodeFactory.getConfigWithLambda(config)
    );
    return node;
  }

  batcher(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<BatcherInputs, BatcherOutputs> {
    const node = this.#create<BatcherInputs, BatcherOutputs>("batcher", config);
    return node;
  }
}
