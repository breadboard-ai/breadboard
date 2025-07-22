/**
 * @fileoverview Connector Load Export
 */
import { type DescribeOutputs } from "@describe";
import { llm } from "../a2/utils";

export { invoke as default, describe };

type Outputs = {
  context: LLMContent[];
};

async function invoke(): Promise<Outcome<Outputs>> {
  return {
    context: [llm`Loading this connector is not yet implemented`.asContent()],
  };
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
