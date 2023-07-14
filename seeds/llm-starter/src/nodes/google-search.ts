/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";

type GoogleSearchInputs = {
  /**
   * The query to search for
   */
  query: string;
  /**
   * The Google Custom Search Engine ID
   */
  GOOGLE_CSE_ID: string;
  /**
   * The Google Cloud Platform API key
   */
  API_KEY: string;
};

type GoogleSearchResponse = {
  items: [
    {
      snippet?: string;
    }
  ];
};

const makeSearchUrl = ({
  query,
  GOOGLE_CSE_ID,
  API_KEY,
}: GoogleSearchInputs) => {
  if (!query) throw new Error("Google search requires `query` input");
  if (!API_KEY) throw new Error("API_KEY is required to use Google search");
  if (!GOOGLE_CSE_ID)
    throw new Error("GOOGLE_CSE_ID is required to use Google search");
  const encodedQuery = encodeURIComponent(query);
  return `https://customsearch.googleapis.com/customsearch/v1?cx=${GOOGLE_CSE_ID}&q=${encodedQuery}&key=${API_KEY}`;
};

const justSnippets = (response: GoogleSearchResponse) => {
  return response.items.map((item) => item.snippet).filter(Boolean) as string[];
};

export default async (inputs: InputValues) => {
  const values = inputs as GoogleSearchInputs;
  const url = makeSearchUrl(values);
  const data = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  const response = await data.json();
  const results = justSnippets(response).join("\n");
  return { results };
};
