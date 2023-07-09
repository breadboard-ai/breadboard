/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeConfiguration,
  NodeHandlers,
  coreHandlers,
} from "@google-labs/graph-runner";
import { Node } from "./node.js";
import { IBreadboard, ILibrary } from "./types.js";

export type OptionalIdConfiguration = { $id?: string } & NodeConfiguration;

/**
 * Syntactic sugar around the `coreHandlers` library.
 */
export class Starter implements ILibrary {
  handlers: NodeHandlers;
  #breadboard: IBreadboard;

  constructor(breadboard: IBreadboard) {
    this.#breadboard = breadboard;
    this.handlers = coreHandlers;
    this.#breadboard.addLibrary(this);
  }

  textTemplate(template: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(
      this.#breadboard,
      "prompt-template",
      { template, ...rest },
      $id
    );
  }

  urlTemplate(template: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(
      this.#breadboard,
      "url_template",
      { template, ...rest },
      $id
    );
  }

  input(message?: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this.#breadboard, "input", { message, ...rest }, $id);
  }

  fetch(raw?: boolean, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this.#breadboard, "fetch", { raw, ...rest }, $id);
  }

  jsonata(expression: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this.#breadboard, "jsonata", { expression, ...rest }, $id);
  }

  xmlToJson(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this.#breadboard, "xml_to_json", { ...rest }, $id);
  }

  textCompletion(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this.#breadboard, "text-completion", { ...rest }, $id);
  }

  secrets(keys: string[], config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this.#breadboard, "secrets", { keys, ...rest }, $id);
  }

  output(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this.#breadboard, "output", { ...rest }, $id);
  }

  include($ref: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this.#breadboard, "include", { $ref, ...rest }, $id);
  }

  reflect(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this.#breadboard, "reflect", { ...rest }, $id);
  }
}
