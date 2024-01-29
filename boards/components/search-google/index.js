/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, board } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";

const metaData = {
  title: "Search Google",
  description:
    "Search Google and return the title and description of the items in the first page of results.",
  version: "0.0.3",
};

const queryScheme = {
  type: "object",
  properties: {
    query: {
      type: "string",
      title: "query",
      description: "What to search for",
    },
  },
  required: ["text"],
};

export default await board(() => {
  const query = base.input({ $id: "input", schema: queryScheme });

  return starter
    .urlTemplate({
      template:
        "https://www.googleapis.com/customsearch/v1?key={PALM_KEY}&cx={GOOGLE_CSE_ID}&q={query}",
      query,
      PALM_KEY: starter.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
      GOOGLE_CSE_ID: starter.secrets({ keys: ["GOOGLE_CSE_ID"] }).GOOGLE_CSE_ID,
    })
    .url.to(starter.fetch())
    .response.to(base.output({ $id: "search_results" }));
}).serialize(metaData);
