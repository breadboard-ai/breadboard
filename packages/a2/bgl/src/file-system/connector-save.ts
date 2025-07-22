/**
 * @fileoverview Connector Save Export.
 */
import { type DescribeOutputs } from "@describe";
import write from "@write";
import { ok } from "../a2/utils";

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

async function invoke({ id, context }: Inputs): Promise<Outcome<Outputs>> {
  if (!context) {
    console.warn("No data to save");
    return { context: [] };
  }
  const path: FileSystemPath = `/mnt/fs/${id}/index.html`;
  const writing = await write({ path, data: context });
  if (!ok(writing)) return writing;
  return { context };
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
