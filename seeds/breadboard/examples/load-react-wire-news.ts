/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Starter } from "@google-labs/breadboard";

import { config } from "dotenv";

config();

// A URL to a repository containing various saved breadboard layouts.
const REPO_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main";

// First, we load the tools board.
const tools = await Board.load("./examples/tools.json");

// Next, we'll wire in another tool right into it.
const kit = new Starter(tools);

const news = kit.include(
  `${REPO_URL}/seeds/breadboard/examples/google-news.json`,
  {
    $id: "news",
    description:
      "Useful for when you need to find news and current events. Input should be a news topic.",
  }
);

kit.input().wire("news->text", news.wire("text", kit.output()));

const board = await Board.load(
  `${REPO_URL}/seeds/graph-playground/graphs/react-with-slot.json`,
  { tools }
);

// Add the inputs.
board.addInputs({
  text: "What's the latest news with breadboards?",
});

// Add the output event handler.
board.on("output", (event) => {
  const { detail } = event as CustomEvent;
  console.log("output", detail.text);
});

// Run the breadboard.
await board.run();
