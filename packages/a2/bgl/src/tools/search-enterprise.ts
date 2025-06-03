/**
 * @fileoverview Search an enterprise search engine.
 */

import toolSearchEnterprise, {
  describe as toolSearchEnterpriseDescribe,
} from "./tool-search-enterprise";
import { Template } from "./a2/template";
import { err, ok, toText, toLLMContent, defaultLLMContent } from "./a2/utils";
export { invoke as default, describe };

type Inputs =
  | {
      context?: LLMContent[];
      "p-query": LLMContent;
    }
  | {
      query: string;
      search_engine_resource_name?: string;
    };

type Outputs =
  | {
      context: LLMContent[];
    }
  | {
      results: string;
    };

async function resolveInput(inputContent: LLMContent): Promise<string> {
  const template = new Template(inputContent);
  const substituting = await template.substitute({}, async () => "");
  if (!ok(substituting)) {
    return substituting.$error;
  }
  return toText(substituting);
}

async function invoke(inputs: Inputs): Promise<Outcome<Outputs>> {
  console.log("ENTERPRISE SEARCH INPUTS", inputs);
  let query: string;
  let search_engine_resource_name: string | undefined;
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
    search_engine_resource_name = inputs.search_engine_resource_name;
    mode = "tool";
  }
  query = (query || "").trim();
  if (!query) {
    return err("Please provide a query");
  }
  if (search_engine_resource_name === undefined) {
    search_engine_resource_name = "";
  }
  console.log("Query: " + query);
  const searchResults = await toolSearchEnterprise({
    query,
    search_engine_resource_name,
  });
  if (!ok(searchResults)) {
    return searchResults;
  }
  const results = searchResults.results;
  if (mode === "step") {
    return {
      context: [toLLMContent(results)],
    };
  }
  return { results };
}

export type DescribeInputs = {
  inputs: Inputs;
  inputSchema: Schema;
  asType?: boolean;
};

async function describe({ asType, ...inputs }: DescribeInputs) {
  const isTool = inputs && Object.keys(inputs).length === 1;
  if (isTool) {
    return toolSearchEnterpriseDescribe();
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
          items: { type: "object", behavior: ["llm-content"] },
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
      icon: "web-search",
      tags: ["quick-access", "tool", "component", "environment-agentspace"],
      order: 2,
    },
  };
}
