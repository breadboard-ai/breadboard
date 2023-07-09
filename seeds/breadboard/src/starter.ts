/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeConfiguration } from "@google-labs/graph-runner";
import { Node } from "./node.js";
import { IBreadboard } from "./types.js";

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

export class Starter {
  #breadboard: IBreadboard;

  constructor(breadboard: IBreadboard) {
    this.#breadboard = breadboard;
  }

  textTemplate({ template }: TextTemplateArgs): Node {
    return new Node(this.#breadboard, "prompt-template", { template });
  }

  urlTemplate({ template }: UrlTemplateArgs): Node {
    return new Node(this.#breadboard, "url_template", { template });
  }

  input({ message }: InputArgs = {}): Node {
    return new Node(this.#breadboard, "input", { message });
  }

  fetch({ raw }: FetchArgs): Node {
    return new Node(this.#breadboard, "fetch", { raw });
  }

  jsonata({ expression }: JsonataArgs): Node {
    return new Node(this.#breadboard, "jsonata", { expression });
  }

  xmlToJson(): Node {
    return new Node(this.#breadboard, "xml_to_json");
  }

  textCompletion(): Node {
    return new Node(this.#breadboard, "text-completion");
  }

  secrets({ keys }: SecretsArgs): Node {
    return new Node(this.#breadboard, "secrets", { keys });
  }

  output(): Node {
    return new Node(this.#breadboard, "output");
  }

  include(config: NodeConfiguration): Node {
    return new Node(this.#breadboard, "include", config);
  }

  reflect(): Node {
    return new Node(this.#breadboard, "reflect", {});
  }
}
