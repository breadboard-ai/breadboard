/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  array,
  board,
  input,
  output,
} from "@breadboard-ai/build";
import { fetch, code } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";

const storyID = input({
  type: "string",
  title: "story ID",
  description: "Hacker News Story ID",
  examples: ["39788322"],
});

const url = urlTemplate({
  $id: "urlTemplate",
  template: "https://hacker-news.firebaseio.com/v0/item/{storyID}.json",
  storyID: storyID
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
  by: "string",
  descendants: "string",
  id: "string",
  kids: array("number"),
  score: "string",
  text: "string",
  time: "string",
  title: "string",
  type: "string",
  url: "string",
}, ({ obj }) => {
  const object = obj;
  if (typeof object !== "object") {
      throw new Error(`object is of type ${typeof object} not object`);
  }

  // some fields may not be set, output currently does not support optional fields
  // so for now set unset field to N/A
  for (const key in object) {
    // @ts-ignore
    if (object[key] == undefined) {
        // @ts-ignore
        object[key] = "N/A"
    }
}
  return { ...object } as any;
})

export default board({
  title: "Hacker News Firebase API Story by ID",
  description: "Board which returns story contents using the Hacker News Firebase API",
  version: "0.1.0",
  inputs: {
      storyID,
  },
  outputs: {
      url: output(url.outputs.url, {
          title: "URL",
          description: "The fetched Hackernews URL",
      }),
      by: output(spreadHackerNewsStoryResponse.outputs.by, {
          title: "Hacker News Story Author",
          description: "Hacker News Story Author",
      }),
      descendants: output(spreadHackerNewsStoryResponse.outputs.descendants, {
          title: "Hacker News Story Number of Descendants",
          description: "Hacker News Story Number of Descendants",
      }),
      id: output(spreadHackerNewsStoryResponse.outputs.id, {
          title: "Hacker News Story ID",
          description: "Hacker News Story ID",
      }),
      kids: output(spreadHackerNewsStoryResponse.outputs.kids, {
          title: "Hacker News Story Kids' IDs'",
          description: "Hacker News Story Kids' IDs'",
      }),
      score: output(spreadHackerNewsStoryResponse.outputs.score, {
          title: "Hacker News Story score",
          description: "Hacker News Story Score ",
      }),
      text: output(spreadHackerNewsStoryResponse.outputs.text, {
          title: "Hacker News Story text",
          description: "Hacker News Story Contents text",
      }),
      title: output(spreadHackerNewsStoryResponse.outputs.title, {
          title: "Hacker News Story title",
          description: "Hacker News Story title",
      }),
      type: output(spreadHackerNewsStoryResponse.outputs.type, {
          title: "Hacker News Story type",
          description: "Hacker News Story type",
      }),
  }
});