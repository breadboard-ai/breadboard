/**
 * @fileoverview The guts of the Get webpage tool.
 */

import fetch from "@fetch";
import { ok } from "./a2/utils";

export { invoke as default, describe };

export type GetWebPageInputs = {
  url: string;
};

export type GetWebPageOutputs = {
  results: string;
};

export type GetWebPageResults = string;

async function invoke({
  url,
}: GetWebPageInputs): Promise<Outcome<GetWebPageOutputs>> {
  const fetching = await fetch({
    url: `https://paulkinlan-markdownify_webpage.web.val.run/?url=${encodeURIComponent(url)}`,
  });
  if (!ok(fetching)) {
    return fetching;
  }
  const results = fetching.response as GetWebPageResults;
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
