/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  board,
  enumeration,
  input,
  object,
  output,
} from "@breadboard-ai/build";
import { fetch, code } from "@google-labs/core-kit";

import { urlTemplate } from "@google-labs/template-kit";

const entity = input({
  description: "Entity type to search for",
  type: enumeration("works",
    "authors",
    "sources",
    "institutions",
    "topics",
    "publishers",
    "funders",
    "concepts"),
  default: "works",
  title: "Entity",
});

const page = input({
  default: "5",
  title: "Results per page",
  description: "Number of results to return per page",
});

const per_page = input({
  default: "5",
  title: "Results per page",
  description: "Number of results to return per page",
});

const search = input({
  type: "string",
  title: "Search term",
  default: "Artificial Intelligence",
  description: "Search term to search for, double quotes for exact match",
});

const select = input({
  type: "string",
  title: "Select",
  default: "id,display_name,title,relevance_score",
  description: "Comma-separated list of fields to return",
});

const urlTemplater = urlTemplate({
  $id: "urlTemplate",
  template:
    "https://api.openalex.org/{entity}?search={search}&page={page}&per_page={per_page}&select={select}",
  entity: entity,
  page: page,
  per_page: per_page,
  search: search,
  select: select,
});

const fetcher = fetch({
  $id: "fetch",
  method: "GET",
  url: urlTemplater.outputs.url,
});

const { spread } = code(
  {
    $id: "spreadResponse",
    $metadata: {
      title: "Spread",
      description: "Spread the properties of an object into a new object",
    },
    obj: fetcher.outputs.response
  },
  { spread: object({}, "string") },
  ({ obj }) => {
    if (typeof obj !== "object") {
      throw new Error(`object is of type ${typeof obj} not object`);
    }
    const spread = { ...obj }
    return { spread };
  }
).outputs;

const results = output(spread, {
  title: "Entity Search Results",
  description: "A list of entities from the search results ",
});

export default board({
  title: "Open Alex Entity Search Results",
  description: "Query the OpenAlex API for a list entities",
  version: "0.0.1",
  inputs: {
    entity,
    page,
    per_page,
    search,
    select
  },
  outputs: { results }
});
