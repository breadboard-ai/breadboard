// /**
//  * @license
//  * Copyright 2024 Google LLC
//  * SPDX-License-Identifier: Apache-2.0
//  *
//  * @title Hacker News Simplified Algolia Search
//  * see: https://hn.algolia.com/api
//  */
import {
  output,
  board,
  annotate,
  input,
  object,
} from "@breadboard-ai/build";
import {
  searchQuery,
  searchTags
} from "./hacker-news-algolia-search";

import { invoke} from "@google-labs/core-kit";

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

const hackerNewsSearchBoard = input({
  $id: "Hacker News Board",
  title: "board location",
  type: annotate(object({}), {
      behavior: ["board"],
  }),
  description: "The URL of the generator to call",
  default: { kind: "board", path: "hacker-news-algolia-search.json" },
});

const hackerNewsOutput = invoke({
  $id: "Hackernews Board Output",
  $board: hackerNewsSearchBoard,
  query: searchQuery,
  tags: searchTags,
  pageNumber: 1,
  searchLimit: "2",
}).unsafeOutput("output");


const objectManipBoard = input({
  $id: "Object Manipulation Board",
  title: "board location",
  type: annotate(object({}), {
      behavior: ["board"],
  }),
  description: "The URL of the generator to call",
  default: { kind: "board", path: "object-manipulator.json" },
})

const forEachBoard = input({
  $id: "Manipulation Board For Each",
  title: "board location",
  type: annotate(object({}), {
      behavior: ["board"],
  }),
  description: "The URL of the generator to call",
  default: { kind: "board", path: "board-for-each.json" }
});

// ignore until object manip board has been refactored
// @ts-ignore
const invokeForEach = invoke({$id: "forEachOutput", $board: forEachBoard, board: objectManipBoard, array:hackerNewsOutput, mode: "pick",
  keys: [
      "created_at",
      "num_comments",
      "comment_text",
      "objectID",
      "points",
      "story_id",
      "title",
      "url",
      "type",
      "_tags"
    ], }).unsafeOutput("outputs")


export default board({
  title: "Hacker News Angolia Simplified Search",
  version: "0.1.0",
  inputs: { query: searchQuery, tags: searchTags, hackerNewsSearchBoard, objectManipBoard, forEachBoard },
  outputs: { output: output(invokeForEach) }
})