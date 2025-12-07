/**
 * @fileoverview Given a URL of a webpage, returns its content as Markdown with a list of links and other metadata.
 */

import { Capabilities, Outcome, Schema } from "@breadboard-ai/types";
import { err, ok } from "../a2/utils.js";
import { executeTool } from "../a2/step-executor.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { invoke as default, describe };

type Inputs = {
  url?: string;
};

type Outputs = {
  results: string;
};

export type GetContentFromUrlResponse = {
  html_body: string;
  markdown?: string;
};

async function getContentFromUrl(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  url: string
): Promise<Outcome<string>> {
  const executing = await executeTool<GetContentFromUrlResponse>(
    caps,
    moduleArgs,
    "get_content_from_url",
    { url }
  );
  if (!ok(executing)) return executing;
  console.log("GET CONTENT", executing);
  if (typeof executing === "string") {
    return err(`Unexpected string response from tool`);
  }
  const { html_body, markdown } = executing;
  if (markdown) {
    return markdown;
  } else {
    return `\`\`\`html\n\n${html_body}\n\n\`\`\``;
  }
}

async function invoke(
  inputs: Inputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<Outputs>> {
  const { url } = inputs;
  if (!url) {
    return err(`URL is a required input to Get Webpage tool`);
  }
  const results = await getContentFromUrl(caps, moduleArgs, url);
  if (!ok(results)) return results;
  return { results };
}

async function describe() {
  return {
    title: "Get Webpage",
    description:
      "Given a URL of a webpage, returns its content as Markdown with a list of links and other metadata.",
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
    metadata: {
      icon: "language",
      tags: ["quick-access", "tool", "component"],
      order: 4,
    },
  };
}
