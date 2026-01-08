/**
 * @fileoverview Connector Load Export
 */
import {
  DescribeOutputs,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { err } from "../a2/utils.js";

export { invoke as default, describe };

type Outputs = {
  context: LLMContent[];
};

async function invoke(): Promise<Outcome<Outputs>> {
  return err("Not implemented");
}

async function describe() {
  return {
    metadata: {
      tags: ["connector-load"],
    },
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
  } satisfies DescribeOutputs;
}
