/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @title Hacker News Simplified Algolia Search
 * see: https://hn.algolia.com/api
 */

import { Schema, base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { graph as forEach } from "./board-for-each";
import {
    graph as search,
    searchQuerySchema,
    searchTagsSchema,
} from "./hacker-news-algolia-search";
import { graph as manipulator } from "./object-manipulator";

const input = base.input({
  schema: {
    type: "object",
    properties: {
      query: searchQuerySchema,
      tags: searchTagsSchema,
    },
  },
  $metadata: { title: "Input" },
});

const invocation = core.invoke({
  $metadata: { title: "Invoke Full Search" },
  $board: search,
  query: input.query,
  tags: input.tags,
});

export const HackerNewsSimplifiedAlgoliaSearchResult: Schema = {
  type: "array",
  title: "Results",
  items: {
    type: "object",
    properties: {
      author: {
        type: "string",
      },
      created_at: {
        type: "string",
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
      type: {
        type: "string",
      },
    },
    required: [
      "author",
      "created_at",
      "num_comments",
      "objectID",
      "points",
      "story_id",
      "title",
      "updated_at",
      "url",
      "objectType",
    ],
  },
};

const output = base.output({
  $metadata: { title: "Output" },
  schema: {
    type: "object",
    properties: {
      output: HackerNewsSimplifiedAlgoliaSearchResult,
    },
  },
});

export interface VerboseSearchResult {
  _highlightResult: HighlightResult;
  _tags: string[];
  author: string;
  children: number[];
  created_at: string;
  created_at_i: number;
  num_comments: number;
  objectID: string;
  points: number;
  story_id: number;
  title: string;
  updated_at: string;
  url: string;
}

export interface HighlightResult {
  author: Author;
  title: Title;
  url: Url;
}

export interface Author {
  matchLevel: string;
  matchedWords: any[];
  value: string;
}

export interface Title {
  fullyHighlighted: boolean;
  matchLevel: string;
  matchedWords: string[];
  value: string;
}

export interface Url {
  matchLevel: string;
  matchedWords: string[];
  value: string;
  fullyHighlighted?: boolean;
}

const invokeForEach = core.invoke({
  $board: forEach,
  board: board(() => {
    const input = base.input({});
    const output = base.output({});
    const manipulate = core.invoke({
      $board: manipulator,
      mode: "pick",
      keys: [
        // "_highlightResult",
        // "_tags",
        "author",
        // "children",
        "created_at",
        // "created_at_i",
        "num_comments",
        "objectID",
        "points",
        "story_id",
        "title",
        "updated_at",
        "url",
        "objectType",
      ],
    });
    const convertTagsToType = code(
      ({ item }: { item: VerboseSearchResult }) => {
        return {
          item: {
            ...item,
            objectType: item["_tags"][0],
          },
        };
      }
    );

    input.item.to(convertTagsToType({})).item.as("object").to(manipulate);

    manipulate.object.as("item").to(output);

    return output;
  }),
  array: invocation.output,
  $metadata: { title: "Manipulate elements" },
});

invokeForEach.array.as("output").to(output);

const serialised = await output.serialize({
  title: "Hacker News Simplified Algolia Search",
});

export { serialised as graph, input, output };
export default serialised;
