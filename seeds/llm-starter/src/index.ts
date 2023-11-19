/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";
import fetch from "./nodes/fetch.js";
import jsonata from "./nodes/jsonata.js";
import promptTemplate from "./nodes/prompt-template.js";
import runJavascript from "./nodes/run-javascript.js";
import secrets from "./nodes/secrets.js";

import urlTemplate from "./nodes/url-template.js";
import xmlToJson from "./nodes/xml-to-json.js";

const builder = new KitBuilder({
  title: "LLM Starter Kit",
  description: "A kit that provides a few necessary components for wiring boards that use PaLM API.",
  version: "0.0.1",
  url: "npm:@google-labs/llm-starter",
});

export const Starter = builder.build({
  fetch,
  jsonata,
  promptTemplate,
  runJavascript,
  secrets,
  urlTemplate,
  xmlToJson,
});

export type Starter = InstanceType<typeof Starter>;

export default Starter;