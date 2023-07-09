/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Node } from "./node.js";
import type { Breadboard } from "./breadboard.js";

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
  #breadboard: Breadboard;

  constructor(breadboard: Breadboard) {
    this.#breadboard = breadboard;
  }

  textTemplate({ template }: TextTemplateArgs): Node {
    return new Node();
  }

  urlTemplate({ template }: UrlTemplateArgs): Node {
    return new Node();
  }

  input({ message }: InputArgs = {}): Node {
    return new Node();
  }

  fetch({ raw }: FetchArgs): Node {
    return new Node();
  }

  jsonata({ expression }: JsonataArgs): Node {
    return new Node();
  }

  xmlToJson(): Node {
    return new Node();
  }

  textCompletion(): Node {
    return new Node();
  }

  secrets({ keys }: SecretsArgs): Node {
    return new Node();
  }

  output(): Node {
    return new Node();
  }

  include(o: unknown): Node {
    return new Node();
  }

  reflect(): Node {
    return new Node();
  }
}
