/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @title Hacker News Simplified Algolia Search
 * see: https://hn.algolia.com/api
 */

import {
  output,
  board,
  annotate,
  input,
  object,
} from "@breadboard-ai/build";

import {
  searchQuery,
} from "./hacker-news-algolia-search";

import { invoke} from "@google-labs/core-kit";

const hackerNewsSimplifiedSearchBoard = input({
  $id: "Simplified Search Board",
  title: "board location",
  type: annotate(object({}), {
      behavior: ["board"],
  }),
  description: "The URL of the generator to call",
  default: { kind: "board", path: "hacker-news-simplified-algolia-search.json" },
});

const simplifiedCommentOutput = invoke({
  $id: "Simplitied Search Output",
  $board: hackerNewsSimplifiedSearchBoard,
  query: searchQuery,
  tags: "comment",
}).unsafeOutput("output");

export default board({
  title: "Hacker News Angolia Simplified Comment Search ",
  version: "0.1.0",
  inputs: { query: searchQuery, hackerNewsSimplifiedSearchBoard},
  outputs: { output: output(simplifiedCommentOutput) }
})