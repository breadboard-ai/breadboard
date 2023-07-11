/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Breadboard } from "@google-labs/breadboard";

import { config } from "dotenv";

config();

// A URL to a repository containing various saved breadboard layouts.
const REPO_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs";

const breadboard = await Breadboard.load(`${REPO_URL}/react-with-slot.json`, {
  tools: await Breadboard.load("./examples/tools.json"),
});

// Add the inputs.
breadboard.addInputs({
  text: "What's the square root of the number of holes on a typical breadboard?",
});

// Add the output event handler.
breadboard.on("output", (event) => {
  const { detail } = event as CustomEvent;
  console.log("output", detail.text);
});

// Run the breadboard.
await breadboard.run();
