/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InvokeOutputs } from "@invoke";
import { err, llm, ok } from "./utils";
import { defaultSafetySettings, GeminiSchema } from "./gemini";
import { GeminiPrompt } from "./gemini-prompt";
import { Params } from "./common";
import { Template } from "./template";
import { flattenContext } from "./lists";

export { forEach };

type PromptList = {
  list: string[];
};

type ForEachInputs = {
  config$prompt: LLMContent;
  [x: string]: unknown;
} & Params;

const SAMPLE_RESPONSE_ONE: PromptList = {
  list: [
    "Create a photo and a haiku for John",
    "Create a photo and a haiku for Sarah",
    "Create a photo and a haiku for Sally",
  ],
};

const SAMPLE_RESPONSE_TWO: PromptList = {
  list: [
    'Write a short poem for Monday that incorporates the following image: {{"type":"asset","path":"1eb84dc9-f26d-4b71-8e1d-550660ee2916","mimeType":"image/png","title":"BasicShapes.png"}}',
    'Write a short poem for Tuesday that incorporates the following image: {{"type":"asset","path":"1eb84dc9-f26d-4b71-8e1d-550660ee2916","mimeType":"image/png","title":"BasicShapes.png"}}',
    'Write a short poem for Wednesday that incorporates the following image: {{"type":"asset","path":"1eb84dc9-f26d-4b71-8e1d-550660ee2916","mimeType":"image/png","title":"BasicShapes.png"}}',
    'Write a short poem for Thursday that incorporates the following image: {{"type":"asset","path":"1eb84dc9-f26d-4b71-8e1d-550660ee2916","mimeType":"image/png","title":"BasicShapes.png"}}',
    'Write a short poem for Friday that incorporates the following image: {{"type":"asset","path":"1eb84dc9-f26d-4b71-8e1d-550660ee2916","mimeType":"image/png","title":"BasicShapes.png"}}',
    'Write a short poem for Saturday that incorporates the following image: {{"type":"asset","path":"1eb84dc9-f26d-4b71-8e1d-550660ee2916","mimeType":"image/png","title":"BasicShapes.png"}}',
    'Write a short poem for Sunday that incorporates the following image: {{"type":"asset","path":"1eb84dc9-f26d-4b71-8e1d-550660ee2916","mimeType":"image/png","title":"BasicShapes.png"}}',
  ],
};

function systemInstruction(): LLMContent {
  return llm`
You are an expert at reinterpreting prompts so that they scaled into into multiple parallel invocations of LLM. You take a prompt the user has written which involves some kind of list of repeating tasks and you return the best interpretation of how that prompt can be split into sub-prompts, one for each task within it.

IMPORTANT: Make sure to add placeholders in double braces to the sub-prompts: they will substituted with the actual values before the sub-prompt is supplied to an LLM.

Here's an example prompt 1:

For John, Sarah, and Sally, create a photo and a haiku.

The response would be

\`\`\`json
${JSON.stringify(SAMPLE_RESPONSE_ONE)}
\`\`\`

Here's an example prompt 2:

For each day of the week, write a short poem that also incorporates the following image:

{{\"type\":\"asset\",\"path\":\"1eb84dc9-f26d-4b71-8e1d-550660ee2916\",\"mimeType\":\"image/png\",\"title\":\"BasicShapes.png\"}}

The response would be

\`\`\`json
${JSON.stringify(SAMPLE_RESPONSE_TWO)}
\`\`\`

`.asContent();
}

function listSchema(): GeminiSchema {
  return {
    type: "object",
    properties: {
      list: {
        type: "array",
        description: "The list of sub-prompts",
        items: {
          type: "string",
          description:
            "A sub-prompt that is a result of splitting one prompt into many",
        },
      },
    },
    required: ["list"],
  };
}

function listPrompt(original: LLMContent, parts: DataPart[]): LLMContent {
  let assetReference: LLMContent | string = "";
  if (parts.length > 0) {
    assetReference = llm`

For context, here are all the values referenced by the placeholders:

${{
  parts,
}}

Do not substitute them. Instead, pass the placeholders as-is and only use these
values to formulate better prompts.
`.asContent();
  }
  return llm`
Analyze the prompt below and instead of acting on it, discern the list of repeating tasks in this prompt and split this prompt into a list of sub-prompts:

BEGIN PROMPT TO ANALYZE

${original}

END PROMPT TO ANALYZE${assetReference}`.asContent();
}

export type AsyncForEachCallback = (
  prompt: LLMContent
) => Promise<Outcome<InvokeOutputs>>;

async function forEach(
  caps: Capabilities,
  inputs: ForEachInputs,
  callback: AsyncForEachCallback
): Promise<InvokeOutputs> {
  const params = Object.fromEntries(
    Object.entries(inputs).filter(([key]) => key.startsWith("p-z-"))
  );
  const template = new Template(inputs.config$prompt);
  const collectedParts: DataPart[] = [];
  const mappedParts = await template.mapParams(
    params,
    (param, part) => {
      const empty = [{ text: "" }];
      switch (param.type) {
        case "tool":
          return empty;
        case "param":
          return empty;
        case "asset":
          collectedParts.push(part);
          return [{ text: `Type "asset": ${param.path}` }, part];
        case "in":
          collectedParts.push(part);
          return [{ text: `Type "in": ${param.path}` }, part];
      }
    },
    async () => ""
  );
  if (!ok(mappedParts)) return mappedParts;
  const splitPrompt = new GeminiPrompt(caps, {
    body: {
      safetySettings: defaultSafetySettings(),
      systemInstruction: systemInstruction(),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: listSchema(),
      },
      contents: [listPrompt(inputs.config$prompt, mappedParts)],
    },
  });
  const splitting = await splitPrompt.invoke();
  if (!ok(splitting)) return splitting;
  const list = (splitting.last?.parts?.at(0) as JSONPart)?.json as PromptList;
  if (!list) {
    // TODO: How to recover here?
    return err(`Failed to execute for each: Invalid response from Gemini`, {
      origin: "server",
      kind: "bug",
    });
  }
  const results = await Promise.all(
    list.list.map(async (itemPrompt) => {
      return callback(llm`${itemPrompt}`.asContent());
    })
  );
  return {
    context: flattenContext(
      [
        {
          parts: [
            {
              id: "for-each",
              list: results
                .filter((item) => !("$error" in item))
                .map((outputs) => {
                  const context = (outputs as { context: LLMContent[] })
                    .context;
                  return {
                    content: context,
                  };
                }),
            },
          ],
        },
      ] satisfies LLMContent[],
      false,
      "\n\n"
    ),
  };
}
