/**
 * @fileoverview Given a URL of a webpage, returns its content as Markdown with a list of links and other metadata.
 */

import toolGetWebpage, {
  describe as toolGetWebpageDescribe,
} from "./tool-get-webpage";
import { Template } from "./a2/template";
import {
  ok,
  err,
  toText,
  toLLMContent,
  defaultLLMContent,
  toTextConcat,
} from "./a2/utils";
import { ListExpander } from "./a2/lists";

export { invoke as default, describe };

export type GetWebPageInputs = {
  url: string;
};

export type GetWebPageOutputs = {
  results: string;
};

async function resolveInput(inputContent: LLMContent): Promise<LLMContent> {
  const template = new Template(inputContent);
  const substituting = await template.substitute({}, async () => "");
  if (!ok(substituting)) {
    return toLLMContent(substituting.$error);
  }
  return substituting;
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

function extractURL(maybeMarkdownLink: string): string {
  // Sometimes Listification returns URLS in markdown format.
  const singleRegex: RegExp = /\[.*?\]\(([^)]+)\)/;
  const match: RegExpMatchArray | null = maybeMarkdownLink.match(singleRegex);

  if (match && match[1]) {
    // match[1] is the content of the first capturing group (the URL)
    const url: string = match[1];
    return url;
  }
  return maybeMarkdownLink;
}

async function invoke(inputs: Inputs): Promise<Outcome<Outputs>> {
  let urlContext: LLMContent[] = [];
  let mode: "step" | "tool";
  if ("context" in inputs) {
    mode = "step";
    if (inputs.context) {
      urlContext = inputs.context;
    } else {
      return err("Please provide a URL");
    }
  } else if ("p-url" in inputs) {
    const urlContent = await resolveInput(inputs["p-url"]);
    if (!ok(urlContent)) {
      return urlContent;
    }
    urlContext = [urlContent];
    mode = "step";
  } else {
    urlContext = [toLLMContent(inputs.url)];
    mode = "tool";
  }
  console.log("urlContext");
  console.log(urlContext);
  const results = await new ListExpander(
    toLLMContent(defaultLLMContent()),
    urlContext
  ).map(async (_, itemContext) => {
    console.log("itemContext");
    console.log(itemContext);
    let urlString = extractURL(toText(itemContext));
    urlString = (urlString || "").trim();
    if (!urlString) {
      return err("Please provide a URL");
    }
    console.log("URL: ", urlString);
    const getting = await toolGetWebpage({ url: urlString });
    if (!ok(getting)) {
      return toLLMContent(getting.$error);
    }
    return toLLMContent(getting.results);
  });

  if (!ok(results)) {
    return results;
  }
  if (mode == "step") {
    return {
      context: results,
    };
  }
  return { results: toTextConcat(results) };
}

export type DescribeInputs = {
  inputs: Inputs;
  inputSchema: Schema;
  asType?: boolean;
};
async function describe({ asType, ...inputs }: DescribeInputs) {
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
      tags: ["quick-access", "tool", "component"],
      order: 4,
    },
  };
}
