/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphTraversalContext, InputValues } from "../graph.js";

import { config } from "dotenv";

config();

const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
if (!GOOGLE_CSE_ID)
  throw new Error("GOOGLE_CSE_ID is required to use Google search");

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("API_KEY is required to use Google search");

const makeSearchUrl = (query: string) => {
  const encodedQuery = encodeURIComponent(query);
  return `https://customsearch.googleapis.com/customsearch/v1?cx=${GOOGLE_CSE_ID}&q=${encodedQuery}&key=${API_KEY}`;
};

type GoogleSearchInputs = {
  query: string;
};

type GoogleSearchResponse = {
  items: [
    {
      snippet?: string;
    }
  ];
};

const justSnippets = (response: GoogleSearchResponse) => {
  return response.items.map((item) => item.snippet).filter(Boolean) as string[];
};

export default async (_cx: GraphTraversalContext, inputs: InputValues) => {
  const values = inputs as GoogleSearchInputs;
  const query = values.query;
  if (!query) throw new Error("Google search requires `query` input");
  const url = makeSearchUrl(query);
  const data = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  const response = await data.json();
  const results = justSnippets(response).join("\n");
  return { results };
};
