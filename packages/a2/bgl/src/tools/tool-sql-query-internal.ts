/**
 * @fileoverview The guts of the internal SQL query tool.
 */

import { ok, err } from "./a2/utils";
import { executeTool } from "./a2/step-executor";

export { invoke as default, describe };

export type QueryInputs = {
  query: string;
};

export type QueryOutputs = {
  results: string;
};

async function invoke({ query }: QueryInputs): Promise<Outcome<QueryOutputs>> {
  const executing = await executeTool<string>("sql_query", {
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
          description: "The SQL query to execute",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        results: {
          type: "string",
          title: "Query Results",
        },
      },
    } satisfies Schema,
  };
}
