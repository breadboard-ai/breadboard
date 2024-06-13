/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @title Hacker News Simplified Algolia Search
 * see: https://hn.algolia.com/api
 */

import { base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import {
  HackerNewsSearchResultsSchema,
  graph as search,
  searchQuerySchema,
  searchTagsSchema,
} from "./hacker-news-algolia-search";

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

const output = base.output({
  $metadata: { title: "Output" },
  schema: HackerNewsSearchResultsSchema,
});

invocation.output.to(output);

const serialised = await output.serialize({
  title: "Hacker News Simplified Algolia Search",
  version: "0.0.1",
});

export { serialised as graph, input, output };
export default serialised;
