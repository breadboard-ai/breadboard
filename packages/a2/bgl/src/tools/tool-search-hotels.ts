/**
 * @fileoverview The guts of the Hotel Search tool.
 */

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
  const executing = await executeTool<string>(caps, "google_hotels.search", {
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
          description: "The query to Hotel Search",
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
