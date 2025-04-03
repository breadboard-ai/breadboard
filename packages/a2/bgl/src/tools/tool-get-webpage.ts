/**
 * @fileoverview The guts of the Get webpage tool.
 */

import fetch from "@fetch";
import { ok, err } from "./a2/utils";
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
  ["`Task_1_responseBody`"]: string;
  header: string;
  status: string;
};

async function getContentFromUrl(url: string): Promise<Outcome<string>> {
  const executing = await executeTool<GetContentFromUrlResponse>(
    "get_content_from_url",
    { url }
  );
  if (!ok(executing)) return executing;
  const output = executing["`Task_1_responseBody`"];
  return `\`\`\`html\n\n${output}\n\n\`\`\``;
}

async function invoke({
  url,
}: GetWebPageInputs): Promise<Outcome<GetWebPageOutputs>> {
  // const fetching = await fetch({
  //   url: `https://paulkinlan-markdownify_webpage.web.val.run/?url=${encodeURIComponent(url)}`,
  // });
  // if (!ok(fetching)) {
  //   return fetching;
  // }
  // const results = fetching.response as GetWebPageResults;
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
