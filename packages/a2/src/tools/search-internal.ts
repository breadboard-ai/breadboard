/**
 * @fileoverview Search using internal search engine.
 */

import { Capabilities, Outcome, Schema } from "@breadboard-ai/types";
import { ok } from "../a2/utils";
import { executeTool } from "../a2/step-executor";
import { A2ModuleArgs } from "../runnable-module-factory";
export { invoke as default, describe };

type Inputs = {
  query: string;
};

type Outputs = {
  results: string;
};

async function invoke(
  { query }: Inputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<Outputs>> {
  const executing = await executeTool<string>(
    caps,
    moduleArgs,
    "enterprise_search",
    {
      query,
    }
  );
  if (!ok(executing)) return executing;

  return { results: executing };
}

export type DescribeInputs = {
  inputs: Inputs;
  inputSchema: Schema;
  asType?: boolean;
};

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
    metadata: {
      icon: "web-search",
      tags: ["quick-access", "tool", "component", "environment-corp"],
      order: 2,
    },
  };
}
