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
    array,
} from "@breadboard-ai/build";
import {
    searchQuery,
    searchTags
} from "./hacker-news-algolia-search";

import { invoke, code } from "@google-labs/core-kit";

export interface HighlightResult {
    author: Author;
    title: Title;
    url: Url;
}

export interface Author {
    matchLevel: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    $id: "query",
    title: "board location",
    type: annotate(object({}), {
        behavior: ["board"],
    }),
    description: "The URL of the generator to call",
    default: { kind: "board", path: "hacker-news-algolia-search.json" },
});

const hackerNewsOutput = invoke({
    $id: "generator",
    $board: hackerNewsSearchBoard,
    query: searchQuery,
    tags: searchTags,
    pageNumber: 1,
    searchLimit: "1",
}).unsafeOutput("output");

// WIP THIS WORKS IF SEARCH RETURNS AN ITEM
// BUT IT RETURNS A LIST, SO NEED TO FIGURE OUT HOW TO LOOP

const objectManipBoard = input({
    $id: "query",
    title: "board location",
    type: annotate(object({}), {
        behavior: ["board"],
    }),
    description: "The URL of the generator to call",
    default: { kind: "board", path: "object-manipulator.json" },
})

const objectManipOutput = invoke({
    $id: "manipulator",
    $board: objectManipBoard,
    object: hackerNewsOutput,
    mode: "pick",
    keys: [
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
}).unsafeOutput("object")

export default board({
    title: "Hacker News Angolia Search Simplified",
    description: "Board which returns story contents using the Hacker News Angolia API",
    version: "0.1.0",
    inputs: { searchQuery, searchTags, hackerNewsSearchBoard, objectManipBoard },
    outputs: { test: output(objectManipOutput) }
})