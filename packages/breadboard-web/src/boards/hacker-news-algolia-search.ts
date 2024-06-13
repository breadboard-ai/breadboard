/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * see: https://hn.algolia.com/api
 */

import { OutputValues, Schema, base, code } from "@google-labs/breadboard";

import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";

export type PostItem = {
  author: string;
  created_at: string;
  created_at_i?: number;
  id: number;
  children?: Comment[];
  story_id: number;
  type: string;
};

export type Comment = PostItem & {
  parent_id: number;
  text: string;
  title: null;
};

export type Story = PostItem & {
  title: string;
  points: number;
  url: string;
};

export type HackerNewsAlgoliaSearchTags =
  | "story"
  | "comment"
  | "poll"
  | "pollopt"
  | "show_hn"
  | "ask_hn"
  | "front_page";
export type NumericFilterField = "created_at_i" | "points" | "num_comments";
export type Operator = "<" | "<=" | "=" | ">" | ">=";

export type HackerNewsSearchNumericFilters = {
  operator: Operator;
  field: NumericFilterField;
  value: number;
};
export type HackerNewAlgoliaSearchParameters = {
  query: string;
  tags?: HackerNewsAlgoliaSearchTags[];
  numericFilters?: HackerNewsSearchNumericFilters[];
  page?: number;
  limit?: number;
};

export type SearchHits = OutputValues & {
  hits: PostItem[];
};

const spread = code<{ object: object }>((inputs) => {
  const object = inputs.object;
  if (typeof object !== "object") {
    throw new Error(`object is of type ${typeof object} not object`);
  }
  return { ...object };
});

const slice = code<{ list: PostItem[]; limit: number }>(({ list, limit }) => {
  return { output: list.slice(0, limit) };
});

const searchLimitSchema: Schema = {
  type: "number",
  title: "limit",
  default: "5",
  description: "Limit the number of results returned by the search",
};

export const searchQuerySchema: Schema = {
  type: "string",
  title: "Query",
  description: "The term to search for",
  default: "Artificial Intelligence",
  examples: ["Artificial Intelligence", "Machine Learning", "Deep Learning"],
};

export const searchTagsSchema: Schema = {
  type: "string",
  title: "Tags",
  default: undefined,
  description: "Filter on a specific tag",
  enum: [
    "story",
    "comment",
    "poll",
    "pollopt",
    "show_hn",
    "ask_hn",
    "front_page",
  ],
};

export const searchPageSchema: Schema = {
  type: "number",
  title: "Page",
  default: "1",
  description: "The page number of the search results to return",
};

export const algoliaSearchSchema: Schema = {
  title: "Hacker News Algolia Search Parameters",
  type: "object",
  properties: {
    query: searchQuerySchema,
    limit: searchLimitSchema,
    tags: searchTagsSchema,
    page: searchPageSchema,
  },
};

const input = base.input({
  $id: "query",
  schema: algoliaSearchSchema,
});

let baseURL = "https://hn.algolia.com/api/v1/search?query={query}";

if (input.tags != undefined) {
  baseURL = baseURL + "&tags={tags}";
}

if (input.page != undefined) {
  baseURL = baseURL + "&page={page}";
}

const urlTemplate = templates.urlTemplate({
  $id: "urlTemplate",
  template: baseURL,
  query: input.query,
  page: input.page,
  tags: input.tags,
});

const fetchUrl = core.fetch({
  $id: "fetch",
  method: "GET",
  url: urlTemplate.url,
});

const response = spread({ $id: "spreadResponse", object: fetchUrl.response });

const sliced = slice({
  list: response.hits as unknown as PostItem[],
  limit: input.limit as unknown as number,
});

export const HackerNewsSearchResultsSchema: Schema = {
  type: "object",
  properties: {
    output: {
      title: "Hacker News Search Results",
      type: "array",
      items: {
        type: "object",
        properties: {
          _highlightResult: {
            type: "object",
            properties: {
              author: {
                type: "object",
                properties: {
                  matchLevel: {
                    type: "string",
                  },
                  matchedWords: {
                    type: "array",
                    items: {},
                  },
                  value: {
                    type: "string",
                  },
                },
                required: ["matchLevel", "matchedWords", "value"],
              },
              title: {
                type: "object",
                properties: {
                  fullyHighlighted: {
                    type: "boolean",
                  },
                  matchLevel: {
                    type: "string",
                  },
                  matchedWords: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  value: {
                    type: "string",
                  },
                },
                required: [
                  "fullyHighlighted",
                  "matchLevel",
                  "matchedWords",
                  "value",
                ],
              },
              url: {
                type: "object",
                properties: {
                  fullyHighlighted: {
                    type: "boolean",
                  },
                  matchLevel: {
                    type: "string",
                  },
                  matchedWords: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  value: {
                    type: "string",
                  },
                },
                required: [
                  "fullyHighlighted",
                  "matchLevel",
                  "matchedWords",
                  "value",
                ],
              },
            },
            required: ["author", "title", "url"],
          },
          _tags: {
            type: "array",
            items: {
              type: "string",
            },
          },
          author: {
            type: "string",
          },
          children: {
            type: "array",
            items: {
              type: "number",
            },
          },
          created_at: {
            type: "string",
          },
          created_at_i: {
            type: "number",
          },
          num_comments: {
            type: "number",
          },
          objectID: {
            type: "string",
          },
          points: {
            type: "number",
          },
          story_id: {
            type: "number",
          },
          title: {
            type: "string",
          },
          updated_at: {
            type: "string",
          },
          url: {
            type: "string",
          },
        },
        required: [
          "_highlightResult",
          "_tags",
          "author",
          "children",
          "created_at",
          "created_at_i",
          "num_comments",
          "objectID",
          "points",
          "story_id",
          "title",
          "updated_at",
          "url",
        ],
      },
    },
  },
};

const output = base.output({
  $metadata: {
    title: "Output",
  },
  schema: HackerNewsSearchResultsSchema,
});

urlTemplate.url.to(output);
sliced.output.to(output);

const serialised = await input.serialize({
  title: "Hacker News Angolia Search",
  description:
    "Board which returns API results based on a query using the Hacker News Angolia API",
  version: "0.0.1",
});
export { serialised as graph, input, output };

export default serialised;
