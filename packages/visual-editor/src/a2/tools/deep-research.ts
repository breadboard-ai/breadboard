/**
 * @fileoverview Searches weather information on Google Search.
 */

import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { err, ok, toLLMContent } from "../a2/utils.js";
import { executeAdkTool } from "../a2/step-executor.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { invoke as default, describe };

export type DeepResearchInput = {
  deepResearchInput: string;
};

export type Outputs = {
  context: LLMContent[];
};

async function invoke(
  inputs: DeepResearchInput,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<Outputs>> {
  const deepResearchInput = (inputs.deepResearchInput || "").trim();
  if (!deepResearchInput) {
    return err("Please provide a deep research input");
  }
  console.log("Deep Research Input: " + deepResearchInput);
  const executing = await executeAdkTool<string>(caps, moduleArgs, "deep_research", {
    deepResearchInput,
  });
  if (!ok(executing)) return executing;
  return {
    context: [
      toLLMContent(
        `Location: ${location}\n\n Weather information: ${executing}`
      ),
    ],
  };
}

async function describe() {
  return {
    title: "Get Weather",
    description: "Searches weather information on Google Search.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          title: "Location",
          description: "The name of the city",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        weather: {
          type: "object",
          title: "Current Weather",
        },
      },
    } satisfies Schema,
    metadata: {
      icon: "sunny",
      tags: ["quick-access", "tool", "component"],
      order: 5,
    },
  };
}
