/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nodes that are commonly used in Generative Applications.
 */
import append from "./nodes/append.js";
import jsonata from "./nodes/jsonata.js";
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import localMemory from "./nodes/local-memory.js";
import runJavascript from "./nodes/run-javascript.js";
import secrets from "./nodes/secrets.js";
import fetch from "./nodes/fetch.js";
import urlTemplate from "./nodes/url-template.js";
import xmlToJson from "./nodes/xml-to-json.js";

export const coreHandlers = {
  append,
  jsonata,
  secrets,
  fetch,
  urlTemplate,
  xmlToJson,
  promptTemplate,
  textCompletion,
  localMemory,
  runJavascript,
};
