/**
 * @fileoverview Given a query, searches the Web with Google Search.
 */

import { ListExpander } from "../a2/lists";
import { Template } from "../a2/template";
import {
  defaultLLMContent,
  err,
  ok,
  toLLMContent,
  toText,
  toTextConcat,
} from "../a2/utils";
import toolSearchWeb, {
  type SearchWebOutputs,
  describe as toolSearchWebDescribe,
} from "./tool-search-web";

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

async function resolveInput(inputContent: LLMContent): Promise<LLMContent> {
  const template = new Template(inputContent);
  const substituting = await template.substitute({}, async () => "");
  if (!ok(substituting)) {
    return toLLMContent(substituting.$error);
  }
  return substituting;
}

function extractQuery(maybeMarkdownListItem: string): string {
  if (maybeMarkdownListItem.startsWith("* ")) {
    return maybeMarkdownListItem.replace("* ", "");
  }
  return maybeMarkdownListItem;
}

async function invoke(
  inputs: Inputs,
  caps: Capabilities
): Promise<Outcome<Outputs>> {
  let query: LLMContent[];
  let mode: "step" | "tool";
  if ("context" in inputs) {
    mode = "step";
    if (inputs.context) {
      query = inputs.context;
    } else {
      return err("Please provide a URL");
    }
  } else if ("p-query" in inputs) {
    const queryContent = await resolveInput(inputs["p-query"]);
    if (!ok(queryContent)) {
      return queryContent;
    }
    query = [queryContent];
    mode = "step";
  } else {
    query = [toLLMContent(inputs.query)];
    mode = "tool";
  }

  const searchResults = await new ListExpander(
    toLLMContent(defaultLLMContent()),
    query
  ).map(async (_, itemContext) => {
    let queryString = extractQuery(toText(itemContext));
    queryString = (queryString || "").trim();
    if (!queryString) {
      return err("Please provide a query");
    }
    console.log("Query: ", queryString);
    const getting = await toolSearchWeb({ query: queryString }, caps);
    if (!ok(getting)) {
      return toLLMContent(getting.$error);
    }
    return toLLMContent(getting.results);
  });
  if (!ok(searchResults)) {
    return searchResults;
  }
  if (mode === "step") {
    return {
      context: searchResults,
    };
  }
  return { results: toTextConcat(searchResults) };
}

export type DescribeInputs = {
  inputs: Inputs;
  inputSchema: Schema;
  asType?: boolean;
};

async function describe({ asType: _, ...inputs }: DescribeInputs) {
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
    title: "Search Web",
    description: "Given a query, searches the Web with Google Search.",
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
      tags: ["quick-access", "tool", "component"],
      order: 1,
    },
  };
}
