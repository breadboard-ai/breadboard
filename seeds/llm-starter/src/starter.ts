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
import { coreHandlers } from "./core.js";
import type {
  BreadboardNode,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
} from "@google-labs/breadboard";
import {
  GenerateTextInputs,
  GenerateTextOutputs,
} from "./nodes/generate-text.js";
import { XmlToJsonInputs, XmlToJsonOutputs } from "./nodes/xml-to-json.js";
import { JsonataInputs, JsonataOutputs } from "./nodes/jsonata.js";
import { FetchInputs, FetchOutputs } from "./nodes/fetch.js";
import {
  PromptTemplateInputs,
  PropmtTemplateOutputs,
} from "./nodes/prompt-template.js";
import { UrlTemplateInputs, UrlTemplateOutputs } from "./nodes/url-template.js";
import {
  RunJavascriptInputs,
  RunJavascriptOutputs,
} from "./nodes/run-javascript.js";
import { AppendInputs, AppendOutputs } from "./nodes/append.js";
import { SecretInputs } from "./nodes/secrets.js";

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

  append<In = AppendInputs>(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In, AppendOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("append", { ...rest }, $id);
  }

  promptTemplate<In = InputValues>(
    template: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In & PromptTemplateInputs, PropmtTemplateOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create(
      "promptTemplate",
      { template, ...rest },
      $id
    );
  }

  urlTemplate<In = InputValues>(
    template: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In & UrlTemplateInputs, UrlTemplateOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("urlTemplate", { template, ...rest }, $id);
  }

  runJavascript<In = InputValues, Out = RunJavascriptOutputs>(
    name: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In & RunJavascriptInputs, Out> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("runJavascript", { name, ...rest }, $id);
  }

  fetch(
    raw?: boolean,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<FetchInputs, FetchOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("fetch", { raw, ...rest }, $id);
  }

  jsonata<Out = OutputValues>(
    expression: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<JsonataInputs, Out & JsonataOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("jsonata", { expression, ...rest }, $id);
  }

  xmlToJson(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<XmlToJsonInputs, XmlToJsonOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("xmlToJson", { ...rest }, $id);
  }

  generateText(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<GenerateTextInputs, GenerateTextOutputs> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("generateText", { ...rest }, $id);
  }

  secrets<Out = OutputValues>(
    keys: string[],
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<SecretInputs, Out> {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("secrets", { keys, ...rest }, $id);
  }
}
