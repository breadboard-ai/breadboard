/**
 * @fileoverview Given a query, searches Wikipedia.
 */

import searchWikipedia, {
  describe as searchWikipediaDescriber,
  type WikipediaInputs,
  type WikipediaOutputs,
} from "./tool-search-wikipedia";
import { Template } from "./a2/template";

import { ok, err, toText, toLLMContent, defaultLLMContent } from "./a2/utils";

export { invoke as default, describe };

async function resolveInput(inputContent: LLMContent): Promise<string> {
  const template = new Template(inputContent);
  const substituting = await template.substitute({}, async () => "");
  if (!ok(substituting)) {
    return substituting.$error;
  }
  return toText(substituting);
}

type Inputs =
  | {
      context?: LLMContent[];
      "p-query": LLMContent;
    }
  | WikipediaInputs;

type Outputs =
  | {
      context: LLMContent[];
    }
  | WikipediaOutputs;

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
  const result = await searchWikipedia({ query });
  if (!ok(result)) {
    return result;
  }
  if (mode == "step") {
    return {
      context: [
        toLLMContent(
          `Query: ${query}\n\n Search Results: \n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
        ),
      ],
    };
  } else {
    return result;
  }

  return { context: [] };
}

export type DescribeInputs = {
  inputs: Inputs;
  inputSchema: Schema;
};

async function describe(inputs: DescribeInputs) {
  const isTool = inputs && Object.keys(inputs).length === 1;
  if (isTool) {
    return searchWikipediaDescriber();
  }
  const hasWires = "context" in (inputs.inputSchema.properties || {});
  const query: Schema["properties"] = hasWires
    ? {}
    : {
        "p-query": {
          type: "object",
          title: "Query",
          description:
            "Please provide the query with which to search Wikipedia",
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
      icon: "globe-book",
      tags: ["quick-access", "tool", "component"],
      order: 3,
    },
  };
}
