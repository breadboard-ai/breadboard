/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @title Hacker News Simplified Algolia Search
 * see: https://hn.algolia.com/api
 */

import { base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { searchQuerySchema } from "./hacker-news-algolia-search";
import {
    HackerNewsSimplifiedAlgoliaSearchResult,
    graph as search,
} from "./hacker-news-simplified-algolia-search";

const input = base.input({
  schema: {
    type: "object",
    properties: {
      query: searchQuerySchema,
    },
  },
  $metadata: { title: "Input" },
});

const invocation = core.invoke({
  $metadata: { title: "Invoke Full Search" },
  $board: search,
  query: input.query,
  tags: "story",
});

const output = base.output({
  $metadata: { title: "Output" },
  schema: {
    type: "object",
    properties: {
      output: HackerNewsSimplifiedAlgoliaSearchResult,
    },
  },
  output: invocation.output,
});

const serialised = await output.serialize({
  title: "Hacker News Simplified Algolia Story Search",
});

export { serialised as graph, input, output };
export default serialised;
