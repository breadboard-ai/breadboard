/**
 * @fileoverview The guts of the Search Enterprise tool.
 */

import { ok, err } from "./a2/utils";
import { executeTool } from "./a2/step-executor";

export { invoke as default, describe };

export type SearchInputs = {
  query: string;
};

export type SearchOutputs = {
  results: string;
};

async function invoke({
  query,
}: SearchInputs): Promise<Outcome<SearchOutputs>> {
  const executing = await executeTool<string>("enterprise_search", {
    query,
  });
  if (!ok(executing)) return executing;

  return { results: executing };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          title: "Query",
          description: "The search query",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        results: {
          type: "string",
          title: "Search Results",
        },
      },
    } satisfies Schema,
  };
}
