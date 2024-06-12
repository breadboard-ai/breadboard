/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @title Hacker News Simplified Algolia Search
 * see: https://hn.algolia.com/api
 */

import { base, code} from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import {
  HackerNewsSearchResultsSchema,
  graph as search,
  searchQuerySchema,
} from "./hacker_news_algolia_search";

const input = base.input({
  schema: {
    type: "object",
    properties: {
      query: searchQuerySchema,
    },
  },
  $metadata: { title: "Input" },
});

const trimResponse = code<{ list: [] }>(({ list}) => {
  list.forEach((item) => {
      delete item["created_at_i"]
      delete item["children"]
      delete item["_tags"]
      delete item["_highlightResult"]
      delete item["num_comments"]
  })

  return { output: list }
})

const invocation = core.invoke({
  $metadata: { title: "Invoke Full Search" },
  $board: search,
  query: input.query,
  tags: "story"
});

const output = base.output({
  $metadata: { title: "Output" },
  schema: HackerNewsSearchResultsSchema,
});

const res = trimResponse({list: invocation.output as unknown as []})

res.output.to(output);

const serialised = await output.serialize({
  title: "Hacker News Algolia Simplified Story Search",
  version: "0.0.1",
});

export { serialised as graph, input, output };
export default serialised;
