/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This is a simple wrapper around existing kits, adding type information.
 *
 * This should of course transition to importing the actual kits, but we first
 * need to add the type support there, probably with Zod.
 */

import {
  NodeValue,
  InputValues,
  OutputValues,
  addKit,
  NodeFactory,
  base,
} from "./lib.js";

import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";

export { base };

export const core = addKit(Core) as unknown as {
  passthrough: NodeFactory<InputValues, OutputValues>;
  // TODO: Other Core nodes.
};

export const llm = addKit(Starter) as unknown as {
  promptTemplate: NodeFactory<
    { template: string; [key: string]: NodeValue },
    { prompt: string }
  >;
  secrets: NodeFactory<{ keys: string[] }, { [k: string]: string }>;
  generateText: NodeFactory<
    { text: string; PALM_KEY: string },
    { completion: string }
  >;
  runJavascript: NodeFactory<
    {
      code: string;
      name: string;
      raw: boolean;
      [key: string]: NodeValue;
    },
    { result: NodeValue; [k: string]: NodeValue }
  >;
  append: NodeFactory<
    { accumulator: NodeValue; [key: string]: NodeValue },
    { accumulator: NodeValue }
  >;
};
