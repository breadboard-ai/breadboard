/**
 * @fileoverview Loads all of the folio into current context.
 */
import read from "@read";
import { ok } from "./a2/utils";

export { invoke as default, describe };

type Inputs = {
  id: string;
};
type Outputs = {
  context: LLMContent[];
};

async function invoke({ id }: Inputs): Promise<Outcome<Outputs>> {
  const readResult = await read({ path: `/local/folio/${id}` });
  if (!ok(readResult)) return readResult;
  return { context: readResult.data || [] };
}

async function describe() {
  return {
    title: "Load Entire Temp File",
    description: "Loads all of the file into current context",
    metadata: {
      tags: ["connector-load"],
    },
    inputSchema: {
      type: "object",
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
