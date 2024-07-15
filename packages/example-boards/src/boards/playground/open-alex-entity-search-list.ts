/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

import { templates } from "@google-labs/template-kit";

const spread = code<{ object: object }>((inputs) => {
  const object = inputs.object;
  if (typeof object !== "object") {
    throw new Error(`object is of type ${typeof object} not object`);
  }
  return { ...object };
});

const openAlexEntities: Schema = {
  description: "Entity type to search for",
  type: "string",
  default: "works",
  enum: [
    "works",
    "authors",
    "sources",
    "institutions",
    "topics",
    "publishers",
    "funders",
    "concepts",
  ],
  title: "Entity",
};

const pageInputSchema: Schema = {
  type: "integer",
  default: "1",
  title: "Page number",
  description: "Page number to return",
};

const perPageInputSchema: Schema = {
  type: "integer",
  default: "5",
  title: "Results per page",
  description: "Number of results to return per page",
};

const selectInputSchema: Schema = {
  type: "string",
  title: "Select",
  default: "id,display_name,title,relevance_score",
  description: "Comma-separated list of fields to return",
};

const searchInputSchema = {
  type: "string",
  title: "Search term",
  default: "Artificial Intelligence",
  description: "Search term to search for, double quotes for exact match",
};

const graph = board(() => {
  const input = base.input({
    $id: "query",
    schema: {
      title: "OpenAlex Search",
      properties: {
        search: searchInputSchema,
        page: pageInputSchema,
        per_page: perPageInputSchema,
        entity: openAlexEntities,
        select: selectInputSchema,
      },
      type: "object",
      required: ["search"],
      additionalProperties: false,
    },
  });

  const urlTemplate = templates.urlTemplate({
    $id: "urlTemplate",
    template:
      "https://api.openalex.org/{entity}?search={search}&page={page}&per_page={per_page}&select={select}",
    entity: input.entity,
    page: input.page,
    per_page: input.per_page,
    search: input.search,
    select: input.select,
  });

  const fetchUrl = core.fetch({
    $id: "fetch",
    method: "GET",
    url: urlTemplate.url,
  });

  const response = spread({ $id: "spreadResponse", object: fetchUrl.response });

  const output = base.output({
    schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to fetch",
          title: "URL",
        },
        meta: {
          type: "object",
          properties: {
            count: {
              type: "integer",
            },
            db_response_time_ms: {
              type: "integer",
            },
            page: {
              type: "integer",
            },
            per_page: {
              type: "integer",
            },
            groups_count: {
              type: ["integer", "null"],
            },
          },
          required: [
            "count",
            "db_response_time_ms",
            "page",
            "per_page",
            "groups_count",
          ],
        },
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
              },
              display_name: {
                type: "string",
              },
              title: {
                type: "string",
              },
              relevance_score: {
                type: "number",
              },
            },
            additionalProperties: true,
          },
        },
        group_by: {
          type: "array",
          items: {},
        },
      },
      required: ["url", "meta", "results", "group_by"],
      additionalProperties: false,
    },
    $id: "response",
    url: urlTemplate.url,
    meta: response.meta,
    results: response.results,
    group_by: response.group_by,
  });
  return output;
});

export default await graph.serialize({
  title: "Open Alex Entity Search Results",
  description: "Query the OpenAlex API for a list entities",
  version: "0.0.1",
});
