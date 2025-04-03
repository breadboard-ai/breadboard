/**
 * @fileoverview The internal-only implementation of the Search Web tool.
 */

import { ToolManager } from "./a2/tool-manager";
import { GeminiPrompt } from "./a2/gemini-prompt";
import { ok, toText } from "./a2/utils";

import secrets from "@secrets";
import fetch from "@fetch";

export { invoke as default, describe };

export type SearchWebInputs = {
  query: string;
};

export type SearchWebOutputs = {
  results: string;
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

async function generateSummary(query: string): Promise<Outcome<string>> {
  const toolManager = new ToolManager();
  toolManager.addSearch();
  const result = await new GeminiPrompt(
    {
      model: "gemini-2.0-flash",
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
      const { title, uri } = chunk.web;
      return `- [${title}](${uri})`;
    }) || [];
  if (chunks.length) {
    results += `\n## References:\n${chunks.join("\n")}\n`;
  }
  return `\n## Summary\n${results}`;
}

function formatSearchResults(results: CustomSearchEngineResponse) {
  return `## Raw Search Results

${results.items
  .map((item) => {
    return `- [${item.title}](${item.link})
${item.snippet}
`;
  })
  .join("\n\n")}
`;
}

async function getSearchLinks(query: string): Promise<Outcome<string>> {
  const keys = await secrets({ keys: ["CSE_ID", "SEARCH_API_KEY"] });
  if (!ok(keys)) {
    return keys;
  }
  const url = `https://customsearch.googleapis.com/customsearch/v1?cx=${keys.CSE_ID}&q=${query}&key=${keys.SEARCH_API_KEY}`;
  const fetching = await fetch({ url });
  if (!ok(fetching)) {
    return fetching;
  }
  const searchResults = fetching.response as CustomSearchEngineResponse;

  return formatSearchResults(searchResults);
}

async function invoke({
  query,
}: SearchWebInputs): Promise<Outcome<SearchWebOutputs>> {
  const [summary, links] = await Promise.all([
    generateSummary(query),
    getSearchLinks(query),
  ]);
  if (!ok(summary)) {
    return summary;
  }
  if (!ok(links)) {
    return links;
  }
  return { results: `Query: ${query}\n${summary}\n${links}` };
}

async function describe() {
  return {
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
  };
}
