/**
 * @fileoverview The guts of the Get webpage tool.
 */

import { ok } from "./a2/utils";
import { executeTool } from "./a2/step-executor";

export { invoke as default, describe };

export type GetWebPageInputs = {
  url: string;
};

export type GetWebPageOutputs = {
  results: string;
};

export type GetWebPageResults = string;

export type GetContentFromUrlResponse = {
  html_body: string;
  markdown?: string;
};

async function getContentFromUrl(url: string): Promise<Outcome<string>> {
  const executing = await executeTool<GetContentFromUrlResponse>(
    "get_content_from_url",
    { url }
  );
  if (!ok(executing)) return executing;
  console.log("GET CONTENT", executing);
  const { html_body, markdown } = executing;
  if (markdown) {
    return markdown;
  } else {
    return `\`\`\`html\n\n${html_body}\n\n\`\`\``;
  }
}

async function invoke({
  url,
}: GetWebPageInputs): Promise<Outcome<GetWebPageOutputs>> {
  const results = await getContentFromUrl(url);
  if (!ok(results)) return results;
  return { results };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          title: "URL",
          description: "The URL of the webpage whose content will retrieved",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        results: {
          type: "string",
          title: "Contents of the webpage",
        },
      },
    } satisfies Schema,
  };
}
