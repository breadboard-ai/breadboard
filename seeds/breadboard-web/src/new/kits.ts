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
  NewNodeValue as NodeValue,
  NewInputValues as InputValues,
  NewOutputValues as OutputValues,
  addKit,
  NewNodeFactory as NodeFactory,
  base,
} from "@google-labs/breadboard";

import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";

export { base };

export const core = addKit(Core) as unknown as {
  passthrough: NodeFactory<InputValues, OutputValues>;
  append: NodeFactory<
    { accumulator: NodeValue; [key: string]: NodeValue },
    { accumulator: NodeValue }
  >;
  // TODO: Other Core nodes.
};

export const palm = addKit(PaLMKit, "palm-") as unknown as {
  generateText: NodeFactory<
    { text: string; PALM_KEY: string },
    { completion: string }
  >;
};

export const starter = addKit(Starter) as unknown as {
  promptTemplate: NodeFactory<
    { template: string; [key: string]: NodeValue },
    { prompt: string }
  >;
  urlTemplate: NodeFactory<
    { template: string; [key: string]: NodeValue },
    { url: string }
  >;
  secrets: NodeFactory<{ keys: string[] }, { [k: string]: string }>;
  runJavascript: NodeFactory<
    {
      code: string;
      name: string;
      raw: boolean;
      [key: string]: NodeValue;
    },
    { result: NodeValue; [k: string]: NodeValue }
  >;
  fetch: NodeFactory<{ url: string }, { response: string }>;
  jsonata: NodeFactory<
    {
      expression: string;
      json: string;
      raw: boolean;
      [key: string]: NodeValue;
    },
    { result: string; [key: string]: NodeValue }
  >;
};
