/**
 * @fileoverview Searches weather information on Google Search.
 */

import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { err, ok, toLLMContent } from "../a2/utils";
import { executeTool } from "../a2/step-executor";
import { A2ModuleArgs } from "../runnable-module-factory";

export { invoke as default, describe };

export type WeatherInputs = {
  location: string;
};

export type Outputs = {
  context: LLMContent[];
};

async function invoke(
  inputs: WeatherInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<Outputs>> {
  const location = (inputs.location || "").trim();
  if (!location) {
    return err("Please provide a location");
  }
  console.log("Location: " + location);
  const executing = await executeTool<string>(caps, moduleArgs, "get_weather", {
    location,
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
