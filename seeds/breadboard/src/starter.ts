/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlers, coreHandlers } from "@google-labs/graph-runner";
import type {
  BreadboardNode,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
} from "./types.js";

/**
 * Syntactic sugar around the `coreHandlers` library.
 */
export class Starter implements Kit {
  #nodeFactory: NodeFactory;
  handlers: NodeHandlers;

  constructor(nodeFactory: NodeFactory) {
    this.#nodeFactory = nodeFactory;
    this.handlers = coreHandlers;
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

  textCompletion(config: OptionalIdConfiguration = {}): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("text-completion", { ...rest }, $id);
  }

  secrets(
    keys: string[],
    config: OptionalIdConfiguration = {}
  ): BreadboardNode {
    const { $id, ...rest } = config;
    return this.#nodeFactory("secrets", { keys, ...rest }, $id);
  }
}
