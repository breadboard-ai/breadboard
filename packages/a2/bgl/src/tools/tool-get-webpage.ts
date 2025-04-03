/**
 * @fileoverview The guts of the Get webpage tool.
 */

import fetch from "@fetch";
import { ok, err } from "./a2/utils";
import { executeStep } from "./a2/step-executor";

export { invoke as default, describe };

export type GetWebPageInputs = {
  url: string;
};

export type GetWebPageOutputs = {
  results: string;
};

export type GetWebPageResults = string;

export type GetContentFromUrlResponse = {
  body: string;
  header: string;
  status: string;
};

async function getContentFromUrl(url: string): Promise<Outcome<string>> {
  const api = "get_content_from_url";
  const response = await executeStep({
    planStep: {
      stepName: api,
      modelApi: api,
      output: "data",
      inputParameters: ["url"],
      isListOutput: false,
    },
    execution_inputs: {
      url: { chunks: [{ mimetype: "text/plain", data: btoa(url) }] },
    },
  });
  if (!ok(response)) return response;

  const data = response?.executionOutputs["data"].chunks.at(0)?.data;
  if (!data) {
    return err(`Invalid response from "${api}" backend`);
  }
  const jsonString = atob(data);
  try {
    const json = JSON.parse(jsonString) as GetContentFromUrlResponse;
    const output = json.body;
    return `\`\`\`html\n\n${output}\n\n\`\`\``;
  } catch (e) {
    return err(
      `Error parsing "${api}" backend response: ${(e as Error).message}`
    );
  }
}

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
  // const results = await getContentFromUrl(url);
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
