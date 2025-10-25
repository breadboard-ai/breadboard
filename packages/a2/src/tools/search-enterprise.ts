/**
 * @fileoverview Search an enterprise search engine.
 */

import { Capabilities, Outcome, Schema } from "@breadboard-ai/types";
import { err, ok } from "../a2/utils";
import { executeTool } from "../a2/step-executor";
import { A2ModuleArgs } from "../runnable-module-factory";
export { invoke as default, describe };

type Inputs = {
  query: string;
  search_engine_resource_name?: string;
};

type Outputs = {
  results: string;
};

async function invoke(
  inputs: Inputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<Outputs>> {
  const { query, search_engine_resource_name } = inputs;
  if (!search_engine_resource_name) {
    return err(`Search engine resource name is required`);
  }
  const executing = await executeTool<string>(
    caps,
    moduleArgs,
    "enterprise_search",
    {
      query,
      search_engine_resource_name,
    }
  );
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
        search_engine_resource_name: {
          type: "string",
          title: "Search Engine Resource Name [Optional]",
          description:
            "An optional resource name for the search backend to use",
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
    metadata: {
      icon: "web-search",
      tags: ["quick-access", "tool", "component", "environment-agentspace"],
      order: 2,
    },
  };
}
