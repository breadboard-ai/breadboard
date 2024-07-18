/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NewNodeFactory,
  NewNodeValue,
  base,
  board,
} from "@google-labs/breadboard";
import { combineContexts } from "../context.js";

export type JoinerType = NewNodeFactory<
  {
    context?: NewNodeValue;
  },
  {
    context: NewNodeValue;
  }
>;

export default await board(({ merge }) => {
  merge
    .isBoolean()
    .behavior("config")
    .title("Merge Contexts")
    .optional()
    .default("false")
    .description("Merge the last items of all incoming conversation into one.");

  const input = base.input({
    $metadata: { title: "Input", description: "Getting all the data" },
  });

  const contextCombiner = combineContexts({
    $metadata: {
      title: "Combine Context",
      description: "Combining context into one",
    },
    ...input,
    merge,
  });

  const output = base.output({
    $metadata: { title: "Output", description: "Returning combined values" },
    context: contextCombiner.context
      .isArray()
      .title("Context out")
      .behavior("llm-content"),
  });
  return output;
}).serialize({
  title: "Joiner",
  metadata: {
    icon: "merge-type",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/agents/#joiner",
    },
  },
  description:
    "Joins two or more worker contexts into one. Great for combining results of multiple workers.",
  version: "0.0.1",
});
