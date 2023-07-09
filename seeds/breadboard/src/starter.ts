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

export type TextTemplateArgs = {
  template: string;
};

export type UrlTemplateArgs = {
  template: string;
};

export type InputArgs = {
  message?: string;
};

export type FetchArgs = {
  raw: boolean;
};

export type JsonataArgs = {
  expression: string;
};

export type SecretsArgs = {
  keys: string[];
};

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

  textTemplate({ template }: TextTemplateArgs, id?: string): Node {
    return new Node(this.#breadboard, "prompt-template", { template }, id);
  }

  urlTemplate({ template }: UrlTemplateArgs, id?: string): Node {
    return new Node(this.#breadboard, "url_template", { template }, id);
  }

  input({ message }: InputArgs = {}, id?: string): Node {
    return new Node(this.#breadboard, "input", { message }, id);
  }

  fetch({ raw }: FetchArgs, id?: string): Node {
    return new Node(this.#breadboard, "fetch", { raw }, id);
  }

  jsonata({ expression }: JsonataArgs, id?: string): Node {
    return new Node(this.#breadboard, "jsonata", { expression }, id);
  }

  xmlToJson(id?: string): Node {
    return new Node(this.#breadboard, "xml_to_json", undefined, id);
  }

  textCompletion(id?: string): Node {
    return new Node(this.#breadboard, "text-completion", undefined, id);
  }

  secrets({ keys }: SecretsArgs, id?: string): Node {
    return new Node(this.#breadboard, "secrets", { keys }, id);
  }

  output(id?: string): Node {
    return new Node(this.#breadboard, "output", undefined, id);
  }

  include(config: NodeConfiguration, id?: string): Node {
    return new Node(this.#breadboard, "include", config, id);
  }

  reflect(id?: string): Node {
    return new Node(this.#breadboard, "reflect", undefined, id);
  }
}
