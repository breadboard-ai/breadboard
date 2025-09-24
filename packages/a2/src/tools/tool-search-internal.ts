/**
 * @fileoverview The guts of the Internal Search tool.
 */

import { Capabilities, Outcome, Schema } from "@breadboard-ai/types";
import { executeTool } from "../a2/step-executor";
import { ok } from "../a2/utils";

export { invoke as default, describe };

export type SearchInputs = {
  query: string;
};

export type SearchOutputs = {
  results: string;
};

async function invoke(
  { query }: SearchInputs,
  caps: Capabilities
): Promise<Outcome<SearchOutputs>> {
  const executing = await executeTool<string>(caps, "enterprise_search", {
    query,
  });
  if (!ok(executing)) return executing;

  return { results: executing };
}

async function describe() {
  return {
    title: "Internal Search",
    description: "Search using internal search engine.",
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
