/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlers, OutputValues } from "@google-labs/graph-runner";
import { coreHandlers } from "./core.js";
import type {
  BreadboardNode,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
} from "@google-labs/breadboard";
import { GenerateTextOutputs } from "./nodes/generate-text.js";
import { XmlToJsonOutputs } from "./nodes/xml-to-json.js";
import { JsonataOutputs } from "./nodes/jsonata.js";
import { FetchOutputs } from "./nodes/fetch.js";
import { PropmtTemplateOutputs } from "./nodes/prompt-template.js";
import { UrlTemplateOutputs } from "./nodes/url-template.js";
import { RunJavascriptOutputs } from "./nodes/run-javascript.js";

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

  append(config: OptionalIdConfiguration = {}): BreadboardNode<OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("append", { ...rest }, $id);
  }

  promptTemplate(
    template: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<PropmtTemplateOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create(
      "promptTemplate",
      { template, ...rest },
      $id
    );
  }

  urlTemplate(
    template: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<UrlTemplateOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("urlTemplate", { template, ...rest }, $id);
  }

  runJavascript(
    name: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<RunJavascriptOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("runJavascript", { name, ...rest }, $id);
  }

  fetch(
    raw?: boolean,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<FetchOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("fetch", { raw, ...rest }, $id);
  }

  jsonata(
    expression: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<JsonataOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("jsonata", { expression, ...rest }, $id);
  }

  xmlToJson(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<XmlToJsonOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("xmlToJson", { ...rest }, $id);
  }

  generateText(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<GenerateTextOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("generateText", { ...rest }, $id);
  }

  secrets(
    keys: string[],
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<OutputValues> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("secrets", { keys, ...rest }, $id);
  }
}
