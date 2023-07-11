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
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs";

const board = await Board.load(`${REPO_URL}/react-with-slot.json`, {
  tools: await Board.load("./examples/tools.json"),
});

// Add the inputs.
board.addInputs({
  text: "What's the square root of the number of holes on a typical breadboard?",
});

// Add the output event handler.
board.on("output", (event) => {
  const { detail } = event as CustomEvent;
  console.log("output", detail.text);
});

// Run the breadboard.
await board.run();
