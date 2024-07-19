/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  array,
  board,
  enumeration,
  input,
  object,
  output,
} from "@breadboard-ai/build";
import { fetch, code, } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";


const searchLimit = input({
  type: "number",
  title: "limit",
  default: 5,
  description: "Limit the number of results returned by the search",
  examples: [5]
})

export const searchQuery = input({
  type: "string",
  title: "Query",
  description: "The term to search for",
  examples: ["Artificial Intelligence", "Machine Learning", "Deep Learning"]
})

export const searchTags = input({
  type: enumeration("story",
    "comment",
    "poll",
    "pollopt",
    "show_hn",
    "ask_hn",
    "front_page"),
  title: "Tags",
  description: "Filter on a specific tag",
})

export const pageNumber = input({
  type: "string",
  title: "Page",
  default: "1",
  description: "The page number to query",
  examples: ["1"]
})

const constructURL = code(
  { id: "urlContructOutput", tags: searchTags, page: pageNumber },
  { url: "string" },
  ({ tags, page }) => {
    let baseURL = "https://hn.algolia.com/api/v1/search?query={query}";

    if (tags != undefined) {
      baseURL = baseURL + "&tags={tags}";
    }

    if (page != undefined) {
      baseURL = baseURL + "&page={page}";
    }

    return { url: baseURL }
  })

const url = urlTemplate({
  $id: "urlTemplate",
  template: constructURL.outputs.url,
  query: searchQuery,
  page: pageNumber,
  tags: searchTags
})

const fetchOutput = fetch({
  $id: "fetch",
  method: "GET",
  url: url.outputs.url,
})

const spreadHackerNewsStoryResponse = code({
  $id: "spreadResponse",
  obj: fetchOutput.outputs.response
}, {
  hits: array(object({
    _highlightResult: object(
      {
        author: object(
          {
            matchLevel: "string",
            matchedWords: array("string"),
            value: "string"
          }),
        title: object(
          {
            fullyHighlighted: "boolean",
            matchlevel: "string",
            matchedWords: array("string"),
            value: "string"
          }),
        url: object(
          {
            fullyHighlighted: "boolean",
            matchlevel: "string",
            matchedWords: array("string"),
            value: "string"

          })
      }),
    _tags: array("string"),
    author: "string",
    children: array("number"),
    created_at: "string",
    created_at_i: "number",
    num_comments: "number",
    objectID: "string",
    points: "number",
    story_id: "number",
    title: "string",
    updated_at: "string",
    url: "string"
  })),
}, ({ obj }) => {
  const object = obj;
  if (typeof object !== "object") {
    throw new Error(`object is of type ${typeof object} not object`);
  }
  // Just in case an expected field is not set
  // output node currently does not support optional fields
  for (const key in object) {
    // @ts-ignore
    if (object[key] == undefined) {
      // @ts-ignore
      object[key] = "N/A"
    }
  }
  // @ts-ignore


  return { ...object } as any;
})

const sliceOutput = code({ $id: "sliceOutput", list: spreadHackerNewsStoryResponse.outputs.hits, limit: searchLimit }, { sliced: "unknown" }, ({ list, limit }) => {
  return { sliced: list.slice(0, limit) };
})

export default board({
  title: "Hacker News Angolia Search",
  description: "Board which returns story contents using the Hacker News Angolia API",
  version: "0.1.0",
  inputs: {
    query: searchQuery,
    tags: searchTags,
    pageNumber: pageNumber,
    searchLimit: searchLimit
  },
  outputs: { searchQuery: url.outputs.url, output: output(sliceOutput.outputs.sliced)}
})