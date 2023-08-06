/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

import { config } from "dotenv";

config();

// A URL to a repository containing various saved breadboard layouts.
const REPO_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main";

// First, we load the tools board.
const tools = await Board.load("./examples/tools.json");

// Next, we'll wire in another tool right into it.
const news = tools.include(
  `${REPO_URL}/seeds/graph-playground/graphs/google-news.json`,
  {
    $id: "news",
    description:
      "Useful for when you need to find news and current events. Input should be a news topic.",
  }
);

tools.input().wire("news->text", news.wire("text", tools.output()));

const board = await Board.load(
  `${REPO_URL}/seeds/graph-playground/graphs/react-with-slot.json`,
  { tools }
);

// Run the breadboard.
const outputs = await board.runOnce({
  text: "What's the latest news on breadboards?",
});
console.log("output", outputs.text);
