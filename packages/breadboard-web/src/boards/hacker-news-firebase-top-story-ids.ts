/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @title Hacker News Simplified Algolia Search
 * see: https://hn.algolia.com/api
 */

import { base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const limitInputSchema = {
  type: "number",
  title: "Story Limit",
  default: "1",
  description: "The Number of Hacker News Story ID's to return",
};

const slice = code<{ list: number[]; limit: number }>(({ list, limit }) => {
  return { output: list.slice(0, limit) };
});

export default await board(() => {
  const input = base.input({
    $id: "limit",
    schema: {
      title: "Hacker News Story",
      properties: {
        limit: limitInputSchema,
      },
    },
    type: "number",
  });

  const { response } = core.fetch({
    $id: "fetch",
    method: "GET",
    url: "https://hacker-news.firebaseio.com/v0/topstories.json",
  });
  const output = base.output({ $id: "main" });
  const sliced = slice({
    list: response as unknown as number[],
    limit: input.limit as unknown as number,
  });

  sliced.to(output);

  return { output };
}).serialize({
  title: "Hacker News Firebase API Story IDs",
  description:
    "Board which returns the top story ID using the Hacker News Firebase API",
  version: "0.0.1",
});
