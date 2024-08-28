/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  board,
  input,
  output,
  starInputs,
} from "@breadboard-ai/build";
import { code } from "@google-labs/core-kit";
import { combineContextsFunction, contextType } from "../context.js";

const merge = input({
  title: "Merge Contexts",
  description: "Merge the last items of all incoming conversation into one.",
  type: annotate("boolean", { behavior: ["config"] }),
  default: false,
});

const contexts = starInputs({ type: contextType });

const merged = code(
  { merge, "*": contexts },
  { context: array(contextType) },
  combineContextsFunction
);

const context = output(merged.outputs.context, { title: "Context out" });

export default board({
  title: "Joiner",
  description:
    "Joins two or more worker contexts into one. Great for combining results of multiple workers.",
  version: "0.0.1",
  metadata: {
    icon: "merge-type",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/agents/#joiner",
    },
  },
  inputs: { merge, "*": contexts },
  outputs: { context },
});
