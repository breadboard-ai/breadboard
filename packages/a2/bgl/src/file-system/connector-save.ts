/**
 * @fileoverview Connector Save Export.
 */
import { type DescribeOutputs } from "@describe";
import { llm } from "../a2/utils";
import type { ConnectorConfiguration } from "./types";

export { invoke as default, describe };

type Inputs = {
  id: string;
  method: "canSave" | "save";
  context?: LLMContent[];
};

type Outputs =
  | {
      context: LLMContent[];
    }
  | {
      canSave: boolean;
    };

async function invoke({
  id,
  method,
  context,
}: Inputs): Promise<Outcome<Outputs>> {
  console.log("SAVING TO FILE SYSTEM", id, method, context);
  return { context: [llm`Saved`.asContent()] };
}

async function describe() {
  return {
    title: "Save To Local File System",
    metadata: {
      tags: ["connector-save"],
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
