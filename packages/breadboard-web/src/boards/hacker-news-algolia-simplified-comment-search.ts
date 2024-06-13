/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @title Hacker News Simplified Algolia Search
 * see: https://hn.algolia.com/api
 */

import { Schema, base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import {
  graph as search,
  searchQuerySchema,
} from "./hacker-news-algolia-search";

const input = base.input({
  schema: {
    type: "object",
    properties: {
      query: searchQuerySchema,
    },
  },
  $metadata: { title: "Input" },
});

const HackerNewsCommentResultsSchema : Schema = {
  type: "object",
  properties: {
    output:{
      title: "Hacker News Comment Results",
      type: "array",
      items: {

      }
    }
  }
}

const invocation = core.invoke({
  $metadata: { title: "Invoke Full Search" },
  $board: search,
  query: input.query,
  tags: "comment",
});

const output = base.output({
  $metadata: { title: "Output" },
});

invocation.output.to(output);

const serialised = await output.serialize({
  title: "Hacker News Algolia Simplified Comment Search",
  version: "0.0.1",
});

export { serialised as graph, input, output };
export default serialised;
