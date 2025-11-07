/**
 * @fileoverview Given a query, searches the Web with Google Search.
 */

import { Capabilities, Outcome, Schema } from "@breadboard-ai/types";
import { GeminiPrompt } from "../a2/gemini-prompt";
import { ToolManager } from "../a2/tool-manager";
import { ok, toText } from "../a2/utils";
import { A2ModuleArgs } from "../runnable-module-factory";

export { invoke as default, describe };
export type SearchWebInputs = {
  query: string;
};

export type SearchWebOutputs = {
  results: string;
};

export type SearchBackendOutput = {
  url: string;
  webpage_text_content: string;
};

export type CustomSearchEngineResponse = {
  queries: {
    request: {
      title: string;
    }[];
  };
  items: {
    title: string;
    snippet: string;
    link: string;
  }[];
};

async function generateSummary(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  query: string
): Promise<Outcome<string>> {
  const toolManager = new ToolManager(caps, moduleArgs);
  toolManager.addSearch();
  const result = await new GeminiPrompt(
    caps,
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
  return `\n## Summary\n${results}`;
}

async function invoke(
  { query }: SearchWebInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<SearchWebOutputs>> {
  const summary = await generateSummary(caps, moduleArgs, query);
  if (!ok(summary)) return summary;

  return { results: `Query: ${query}\n${summary}` };
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
