/**
 * @fileoverview Given a query, searches the Web with Google Search.
 */

import gemini, { type GeminiInputs } from "./a2/gemini";
import { Template } from "./a2/template";
import { ToolManager } from "./a2/tool-manager";
import { GeminiPrompt } from "./a2/gemini-prompt";
import {
  ok,
  err,
  toText,
  toLLMContent,
  addUserTurn,
  defaultLLMContent,
} from "./a2/utils";
import toolSearchWeb, {
  type SearchWebOutputs,
  describe as toolSearchWebDescribe,
} from "./tool-search-web";

import fetch from "@fetch";

export { invoke as default, describe };

type Inputs =
  | {
      context?: LLMContent[];
      "p-query": LLMContent;
    }
  | {
      query: string;
    };

type Outputs =
  | {
      context: LLMContent[];
    }
  | SearchWebOutputs;

async function resolveInput(inputContent: LLMContent): Promise<string> {
  const template = new Template(inputContent);
  const substituting = await template.substitute({}, async () => "");
  if (!ok(substituting)) {
    return substituting.$error;
  }
  return toText(substituting);
}

async function invoke(inputs: Inputs): Promise<Outcome<Outputs>> {
  let query: string;
  let mode: "step" | "tool";
  if ("context" in inputs) {
    mode = "step";
    const last = inputs.context?.at(-1);
    if (last) {
      query = toText(last);
    } else {
      return err("Please provide a query");
    }
  } else if ("p-query" in inputs) {
    query = await resolveInput(inputs["p-query"]);
    mode = "step";
  } else {
    query = inputs.query;
    mode = "tool";
  }
  query = (query || "").trim();
  if (!query) {
    return err("Please provide a query");
  }
  console.log("Query: " + query);
  const searchResults = await toolSearchWeb({ query });
  if (!ok(searchResults)) {
    return searchResults;
  }
  if (mode === "step") {
    return { context: [toLLMContent(searchResults.results)] };
  }
  return searchResults;
}

export type DescribeInputs = {
  inputs: Inputs;
  inputSchema: Schema;
};

async function describe(inputs: DescribeInputs) {
  const isTool = inputs && Object.keys(inputs).length === 1;
  if (isTool) {
    return toolSearchWebDescribe();
  }
  const hasWires = "context" in (inputs.inputSchema.properties || {});
  const query: Schema["properties"] = hasWires
    ? {}
    : {
        "p-query": {
          type: "object",
          title: "Search query",
          description: "Please provide a search query",
          behavior: [
            "llm-content",
            "config",
            "hint-preview",
            "hint-single-line",
          ],
          default: defaultLLMContent(),
        },
      };

  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: {
            type: "object",
            behavior: ["llm-content"],
          },
          title: "Context in",
          behavior: ["main-port"],
        },
        ...query,
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
          behavior: ["main-port"],
        },
      },
    } satisfies Schema,
    metadata: {
      icon: "search",
      tags: ["quick-access", "tool"],
      order: 1,
    },
  };
}
