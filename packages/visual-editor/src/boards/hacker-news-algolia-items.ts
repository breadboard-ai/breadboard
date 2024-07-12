import {
  array,
  board,
  input,
  output,
} from "@breadboard-ai/build";
import { fetch, code } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";

const ID = input({
  type: "string",
  title: "story ID",
  description: "Hacker News Story ID",
  examples: ["39788322"],
});

const url = urlTemplate({
  $id: "urlTemplate",
  template: "https://hn.algolia.com/api/v1/items/{ID}",
  ID: ID
})

const fetchOutput = fetch({
  $id: "fetch",
  method: "GET",
  url: url.outputs.url,
})

// TODO properly do output schema
const spreadHackerNewsStoryResponse = code({
  $id: "spreadResponse",
  obj: fetchOutput.outputs.response
}, {
  author: "string",
  // children themselves cause also have children, not sure how to do that
  children: array("unknown"),
  created_at: "string",
  created_at_i: "number",
  options: array("string"),
  parent_id: "number",
  points: "number",
  id: "number",
  text: "string",
  title: "string",
  type: "string",
  url: "string",
}, ({ obj }) => {
  if (obj == undefined) {
      throw new Error(`object is undefined`);
  }

  const object = obj;
  if (typeof object !== "object") {
      throw new Error(`object is of type ${typeof object} not object`);
  }
  // depending if we grab a story, child ... it may not have some set fields
  // output nodes currently do not support optional outputs
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
  title: "Hacker News Algolia Items",
  description: "Fetch a single item from the Hacker News Algolia API",
  version: "0.1.0",
  inputs: {
      ID,
  },
  outputs: {
      author: output(spreadHackerNewsStoryResponse.outputs.author, {
          title: "Hacker News item author",
          description: "Hacker News item author",
      }),
      children: output(spreadHackerNewsStoryResponse.outputs.children, {
          title: "Hacker News item children IDs'",
          description: "Hacker News item children' IDs'",
      }),
      created_at: output(spreadHackerNewsStoryResponse.outputs.created_at, {
          title: "Hacker News item created_at'",
          description: "Hacker News item created_at'",
      }),
      created_at_i: output(spreadHackerNewsStoryResponse.outputs.created_at_i, {
          title: "Hacker News Story created_at timestamp'",
          description: "Hacker item item created_at timestamp'",
      }),

      id: output(spreadHackerNewsStoryResponse.outputs.id, {
          title: "Hacker News item ID",
          description: "Hacker News item ID",
      }),
      parent_id: output(spreadHackerNewsStoryResponse.outputs.parent_id, {
          title: "Hacker News item parent ID",
          description: "Hacker News item parent ID",
      }),

      points: output(spreadHackerNewsStoryResponse.outputs.points, {
          title: "Hacker News item Points",
          description: "Hacker News item Points",
      }),
      text: output(spreadHackerNewsStoryResponse.outputs.text, {
          title: "Hacker News item text Field",
          description: "Hacker News item text ",
      }),
      title: output(spreadHackerNewsStoryResponse.outputs.title, {
          title: "Hacker News item title Field",
          description: "Hacker News item title",
      }),
      type: output(spreadHackerNewsStoryResponse.outputs.type, {
          title: "Hacker News item type Field",
          description: "Hacker News item type",
      }),
      url: output(url.outputs.url, {
          title: "item URL",
          description: "The fetched Hackernews item URL",
      }),
  }
});