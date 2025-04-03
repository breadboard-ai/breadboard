/**
 * @fileoverview Given a URL of a webpage, returns its content as Markdown with a list of links and other metadata.
 */

import toolGetWebpage, {
  describe as toolGetWebpageDescribe,
} from "./tool-get-webpage";
import { Template } from "./a2/template";
import { ok, err, toText, toLLMContent, defaultLLMContent } from "./a2/utils";

export { invoke as default, describe };

export type GetWebPageInputs = {
  url: string;
};

export type GetWebPageOutputs = {
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

type Inputs =
  | {
      context?: LLMContent[];
      "p-url": LLMContent;
    }
  | GetWebPageInputs;

type Outputs =
  | {
      context: LLMContent[];
    }
  | GetWebPageOutputs;

async function invoke(inputs: Inputs): Promise<Outcome<Outputs>> {
  let url: string;
  let mode: "step" | "tool";
  if ("context" in inputs) {
    mode = "step";
    const last = inputs.context?.at(-1);
    if (last) {
      url = toText(last);
    } else {
      return err("Please provide a query");
    }
  } else if ("p-url" in inputs) {
    url = await resolveInput(inputs["p-url"]);
    mode = "step";
  } else {
    url = inputs.url;
    mode = "tool";
  }
  url = (url || "").trim();
  if (!url) {
    return err("Please provide a URL");
  }
  console.log("URL: " + url);
  const getting = await toolGetWebpage({ url });
  if (!ok(getting)) {
    return getting;
  }
  if (mode == "step") {
    return {
      context: [toLLMContent(getting.results)],
    };
  }
  return getting;
}

export type DescribeInputs = {
  inputs: Inputs;
  inputSchema: Schema;
};
async function describe(inputs: DescribeInputs) {
  const isTool = inputs && Object.keys(inputs).length === 1;
  if (isTool) {
    return toolGetWebpageDescribe();
  }
  const hasWires = "context" in (inputs.inputSchema.properties || {});
  const query: Schema["properties"] = hasWires
    ? {}
    : {
        "p-url": {
          type: "object",
          title: "URL",
          description: "Please provide URL of the webpage",
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
      icon: "language",
      tags: ["quick-access", "tool"],
      order: 4,
    },
  };
}
