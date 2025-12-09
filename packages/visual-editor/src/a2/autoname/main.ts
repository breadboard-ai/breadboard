/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeminiPrompt } from "../a2/gemini-prompt.js";
import { defaultSafetySettings } from "../a2/gemini.js";
import { err, ok } from "../a2/utils.js";

import type { AutonameMode, Arguments } from "./types.js";
import { NodeConfigurationUpdateMode } from "./node-configuration-update.js";
import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { invoke as default, describe };

type Inputs = {
  context: LLMContent[];
};

type Outputs = {
  context: LLMContent[];
};

function getArguments(context?: LLMContent[]): Outcome<Arguments> {
  const part = context?.at(-1)?.parts?.at(0);
  if (!(part && "json" in part)) {
    return err(`Invalid arguments: ${context}`);
  }
  return part.json as Arguments;
}

function cantAutoname() {
  return [{ parts: [{ json: { notEnoughContext: true } }] }];
}

const MODES: Record<
  string,
  new (caps: Capabilities, args: Arguments) => AutonameMode
> = {
  nodeConfigurationUpdate: NodeConfigurationUpdateMode,
};

async function invoke(
  { context }: Inputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<Outputs>> {
  const args = getArguments(context);
  if (!ok(args)) return args;
  const mode = MODES[Object.keys(args)[0]];
  if (!mode) {
    return err(`Unknown mode: ${JSON.stringify(args)}`);
  }
  const modeHandler = new mode(caps, args);
  if (!modeHandler.canAutoname()) {
    return { context: cantAutoname() };
  }
  const naming = await new GeminiPrompt(caps, moduleArgs, {
    model: "gemini-2.0-flash-lite",
    body: {
      contents: modeHandler.prompt(),
      safetySettings: defaultSafetySettings(),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: modeHandler.schema(),
      },
    },
  }).invoke();
  if (!ok(naming)) return naming;
  return { context: naming.all };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
        },
      },
    } satisfies Schema,
  };
}
