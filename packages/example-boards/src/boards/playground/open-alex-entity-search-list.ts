/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  anyOf,
  array,
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
  type: enumeration(
    "works",
    "authors",
    "sources",
    "institutions",
    "topics",
    "publishers",
    "funders",
    "concepts"
  ),
  default: "works",
  title: "Entity",
});

const page = input({
  type: "string", // TODO(Tina): This needs to be changed to "number" once the TemplateKit `urlTemplate` wildcard input also accepts numbers.
  default: "5",
  title: "Results per page",
  description: "Number of results to return per page",
});

const per_page = input({
  type: "string", // TODO(Tina): This needs to be changed to "number" once the TemplateKit `urlTemplate` wildcard input also accepts numbers.
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

const url = urlTemplate({
  $id: "urlTemplate",
  template:
    "https://api.openalex.org/{entity}?search={search}&page={page}&per_page={per_page}&select={select}",
  entity: entity,
  page: page,
  per_page: per_page,
  search: search,
  select: select,
});

const fetchResult = fetch({
  $id: "fetch",
  method: "GET",
  url: url.outputs.url,
});

const spreadOpenAlexResponse = code(
  {
    $id: "spreadResponse",
    $metadata: {
      title: "Spread",
      description: "Spread the properties of the Open Alex response",
    },
    obj: fetchResult.outputs.response
  },
  {
    results: array(object({
      id: "string",
      display_name: "string",
      title: "string",
      relevance_score: "number"
    }, anyOf("string", "number", "boolean", "unknown"))),
    meta: object({
      count: "number",
      db_response_time_ms: "number",
      page: "number",
      per_page: "number"
    })
  },
  ({ obj }) => {
    if (typeof obj !== "object") {
      throw new Error(`object is of type ${typeof obj} not object`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ...obj } as any;
  }
);

export default board({
  title: "Open Alex Entity Search Results",
  description: "Query the OpenAlex API for a list entities",
  version: "0.1.0",
  inputs: {
    entity,
    page,
    per_page,
    search,
    select,
  },
  outputs: {
    url: output(url.outputs.url, {
      title: "URL",
      description: "The fetched Open Alex URL",
    }),
    meta: output(spreadOpenAlexResponse.outputs.meta, {
      title: "Search Result Metadata",
      description: "The metadata from the search results",
    }),
    results: output(spreadOpenAlexResponse.outputs.results, {
      title: "Entity Search Results",
      description: "A list of entities from the search results",
    }),
  }
});
