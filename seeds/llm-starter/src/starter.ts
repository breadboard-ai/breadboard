/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlers } from "@google-labs/graph-runner";
import { coreHandlers } from "./core.js";
import type {
  BreadboardNode,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
} from "@google-labs/breadboard";

/**
 * Syntactic sugar around the `coreHandlers` library.
 */
export class Starter implements Kit {
  url = "npm:@google-labs/llm-starter";
  #nodeFactory: NodeFactory;
  #handlers: NodeHandlers;

  get handlers() {
    return this.#handlers;
  }

  constructor(nodeFactory: NodeFactory) {
    this.#nodeFactory = nodeFactory;
    this.#handlers = coreHandlers;
  }

  textTemplate(
    template: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("prompt-template", { template, ...rest }, $id);
  }

  urlTemplate(
    template: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("url_template", { template, ...rest }, $id);
  }

  runJavascript(
    name: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("run-javascript", { name, ...rest }, $id);
  }

  fetch(raw?: boolean, config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("fetch", { raw, ...rest }, $id);
  }

  jsonata(
    expression: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("jsonata", { expression, ...rest }, $id);
  }

  xmlToJson(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("xml_to_json", { ...rest }, $id);
  }

  localMemory(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("local-memory", { ...rest }, $id);
  }

  textCompletion(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("text-completion", { ...rest }, $id);
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

  secrets(
    keys: string[],
    config: OptionalIdConfiguration = {}
  ): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("secrets", { keys, ...rest }, $id);
  }
}
