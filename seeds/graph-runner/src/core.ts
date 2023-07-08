/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Truly core nodes that are necessary for building and composing graphs.
 */
import input from "./nodes/input.js";
import output from "./nodes/output.js";
import passthrough from "./nodes/passthrough.js";
import include from "./nodes/include.js";
import vars from "./nodes/vars.js";
import slot from "./nodes/slot.js";
import jsonata from "./nodes/jsonata.js";

/**
 * Nodes that are commonly used in Generative Applications.
 */
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import localMemory from "./nodes/local-memory.js";
import javascript from "./nodes/run-javascript.js";
import googleSearch from "./nodes/google-search.js";
import reflect from "./nodes/reflect.js";
import secrets from "./nodes/secrets.js";
import fetch from "./nodes/fetch.js";
// intentionally breaking convention here.
// See https://github.com/google/labs-prototypes/issues/22
import url_template from "./nodes/url-template.js";
import xml_to_json from "./nodes/xml-to-json.js";

/**
 * A node-producing wrapper to create custom nodes.
 */
export { customNode } from "./nodes/custom-node.js";

export const coreHandlers = {
  input,
  output,
  passthrough,
  include,
  vars,
  slot,
  jsonata,
  reflect,
  secrets,
  fetch,
  url_template,
  xml_to_json,
  "prompt-template": promptTemplate,
  "text-completion": textCompletion,
  "local-memory": localMemory,
  "run-javascript": javascript,
  "google-search": googleSearch,
};
