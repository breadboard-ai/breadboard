/**
 * @fileoverview The internal-only implementation of the Search Web tool.
 */

import { ToolManager } from "./a2/tool-manager";
import { GeminiPrompt } from "./a2/gemini-prompt";
import { ok, err, toText } from "./a2/utils";
import { executeTool } from "./a2/step-executor";
import { StreamableReporter } from "./a2/output";

import secrets from "@secrets";
import fetch from "@fetch";

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
  query: string,
  reporter: StreamableReporter
): Promise<Outcome<string>> {
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
  await reporter.sendUpdate("Search Summary", results, "text_analysis");
  const links = result.candidate?.groundingMetadata?.groundingChunks?.map(
    (chunk) => chunk.web
  );
  if (links) {
    await reporter.sendLinks("References", links, "link");
  }
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

function formatBackendSearchResults(
  results: SearchBackendOutput[] | string
): string {
  if (typeof results === "string") {
    return results;
  }
  return `## Search Results

    ${results
      .map((result) => {
        return `## Source: ${result.url}
Source content:

${result.webpage_text_content}
`;
      })
      .join("\n\n")}
`;
}

async function getSearchLinks(
  query: string,
  reporter: StreamableReporter
): Promise<Outcome<string>> {
  const results = await executeTool<SearchBackendOutput[]>("google_search", {
    query,
  });
  if (!ok(results)) return results;
  const formattedResults = formatBackendSearchResults(results);
  await reporter.sendUpdate("Search Links", formattedResults, "link");
  return formattedResults;
}

async function invoke({
  query,
}: SearchWebInputs): Promise<Outcome<SearchWebOutputs>> {
  const reporter = new StreamableReporter({
    title: "Searching Web",
    icon: "search",
  });
  try {
    await reporter.start();
    await reporter.sendUpdate("Search term", query, "search");
    const [summary, links] = await Promise.all([
      generateSummary(query, reporter),
      getSearchLinks(query, reporter),
    ]);
    if (!ok(summary)) {
      return summary;
    }
    if (!ok(links)) {
      return links;
    }
    return { results: `Query: ${query}\n${summary}\n${links}` };
  } finally {
    reporter.close();
  }
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
