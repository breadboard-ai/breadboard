/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nodes that are commonly used in Generative Applications.
 */
import textAsset from "./nodes/text-asset.js";
import textAssetsFromPath from "./nodes/text-assets-from-path.js";
import vars from "./nodes/vars.js";
import jsonata from "./nodes/jsonata.js";
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import localMemory from "./nodes/local-memory.js";
import javascript from "./nodes/run-javascript.js";
import secrets from "./nodes/secrets.js";
import fetch from "./nodes/fetch.js";
// intentionally breaking convention here.
// See https://github.com/google/labs-prototypes/issues/22
import url_template from "./nodes/url-template.js";
import xml_to_json from "./nodes/xml-to-json.js";
import create_vector_database from "./nodes/create-vector-database.js";
import add_to_vector_database from "./nodes/add-to-vector-database.js";
import query_vector_database from "./nodes/query-vector-database.js";
import embed_docs from "./nodes/embed-docs.js";
import embed_strings from "./nodes/embed-string.js";

export const coreHandlers = {
  vars,
  jsonata,
  secrets,
  fetch,
  url_template,
  xml_to_json,
  create_vector_database,
  add_to_vector_database,
  query_vector_database,
  embed_docs,
  embed_strings,
  "prompt-template": promptTemplate,
  "text-completion": textCompletion,
  "local-memory": localMemory,
  "run-javascript": javascript,
  "text-asset": textAsset,
  "text-assets-from-path": textAssetsFromPath,
};
