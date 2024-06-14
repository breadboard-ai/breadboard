/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * see: https://hn.algolia.com/api
 */

import { Schema, base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { spread } from "../utils/spread";

const storyInputSchema: Schema = {
  type: "string",
  title: "Object ID",
  examples: ["39788322"],
  description: "ID of object to fetch from Hacker News Algolia API",
};

const ID = "OBJECT_ID";

const input = base.input({
  $metadata: {
    title: "Input",
  },
  schema: {
    properties: {
      [ID]: storyInputSchema,
    },
  },
});

const urlTemplate = templates.urlTemplate({
  $metadata: {
    title: "URL Template ",
  },
  template: `https://hn.algolia.com/api/v1/items/{${ID}}`,
  [ID]: input[ID],
});

const fetchUrl = core.fetch({
  $metadata: {
    title: "Fetch",
  },
  method: "GET",
  url: urlTemplate.url,
});

const output = base.output({
  $metadata: {
    title: "Output",
  },
  schema: {
    type: "object",
    properties: {
      author: {
        type: "string",
      },
      children: {
        type: "array",
        items: {
          type: "object",
        },
      },
      created_at: {
        type: "string",
      },
      created_at_i: {
        type: "number",
      },
      id: {
        type: "number",
      },
      options: {
        type: "array",
        items: {},
      },
      parent_id: {
        type: "number",
      },
      points: {
        type: "number",
      },
      story_id: {
        type: "number",
      },
      text: {},
      title: {
        type: "string",
      },
      type: {
        type: "string",
      },
      url: {
        type: "string",
      },
    },
    required: [
      "author",
      "children",
      "created_at",
      "created_at_i",
      "id",
      "options",
      "parent_id",
      "points",
      "story_id",
      "text",
      "title",
      "type",
      "url",
    ],
  },
});

const response = spread({
  $id: "spreadResponse",
  object: fetchUrl.response,
  $metadata: { title: "Spread Response" },
});

response.to(output);

const serialised = await input.serialize({
  title: "Hacker News Algolia Items",
  description: "Fetch a single item from the Hacker News Algolia API",
});
export { serialised as graph, input, output };
export default serialised;
