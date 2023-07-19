/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nodes that are commonly used in Generative Applications.
 */
import textAsset from "./nodes/text-asset.js";
import vars from "./nodes/vars.js";
import jsonata from "./nodes/jsonata.js";
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import localMemory from "./nodes/local-memory.js";
import javascript from "./nodes/run-javascript.js";
import googleSearch from "./nodes/google-search.js";
import secrets from "./nodes/secrets.js";
import fetch from "./nodes/fetch.js";
// intentionally breaking convention here.
// See https://github.com/google/labs-prototypes/issues/22
import url_template from "./nodes/url-template.js";
import xml_to_json from "./nodes/xml-to-json.js";

export const coreHandlers = {
  vars,
  jsonata,
  secrets,
  fetch,
  url_template,
  xml_to_json,
  "prompt-template": promptTemplate,
  "text-completion": textCompletion,
  "local-memory": localMemory,
  "run-javascript": javascript,
  "google-search": googleSearch,
  "text-asset": textAsset,
};
