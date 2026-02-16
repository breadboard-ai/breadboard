/**
 * @fileoverview Given a query, searches the Web with Google Search.
 */

import { Outcome, Schema } from "@breadboard-ai/types";
import { GeminiPrompt } from "../a2/gemini-prompt.js";
import { ToolManager } from "../a2/tool-manager.js";
import { ok, toText } from "../a2/utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { invoke as default, describe };

export type SearchWebInputs = {
  query: string;
};

export type SearchWebOutputs = {
  results: string;
};

async function invoke(
  { query }: SearchWebInputs,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<SearchWebOutputs>> {
  const toolManager = new ToolManager(moduleArgs);
  toolManager.addSearch();
  const result = await new GeminiPrompt(
    moduleArgs,
    {
      body: {
        contents: [{ parts: [{ text: query }] }],
        tools: toolManager.list(),
      },
    },
    toolManager
  ).invoke();
  if (!ok(result)) {
    return result;
  }
  let results = toText(result.last);
  const chunks =
    result.candidate?.groundingMetadata?.groundingChunks?.map((chunk) => {
      const { title, uri } = chunk.web!;
      return `- [${title}](${uri})`;
    }) || [];
  if (chunks.length) {
    results += `\n## References:\n${chunks.join("\n")}\n`;
  }
  return { results: `\n## Summary\n${results}` };
}

async function describe() {
  return {
    title: "Search Web",
    description: "Given a query, searches the Web with Google Search.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          title: "Query",
          description: "The query to use with which to search the Web",
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
    metadata: {
      icon: "search",
      tags: ["quick-access", "tool", "component"],
      order: 1,
    },
  };
}
