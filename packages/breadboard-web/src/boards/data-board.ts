/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";

const gemini =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/breadboard-web/public/graphs/gemini-generator.json";
const jsonAgent =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/breadboard-web/public/graphs/json-agent.json";

const adSchema = {
  type: "object",
  properties: {
    ad: {
      type: "string",
      description: "the ad copy",
    },
  },
} satisfies Schema;

const requirementsSchema = {
  type: "object",
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "string",
        description: "a prompt requirement",
      },
    },
  },
} satisfies Schema;

export default await recipe(({ specs, generator }) => {
  specs
    .title("Ad specs")
    .format("multiline")
    .examples(
      `This ad is for my lawn care company that will fit into an inch of newspaper copy. It's called "Max's Lawn Care" and it should use the slogan "I care about your lawn." Emphasize the folksiness of it being a local, sole proprietorship that I started after graduating from high school.`
    );
  generator.title("Generator").examples(gemini);

  const requirementsExtractor = core.invoke({
    $id: "requiremenstExtractor",
    text: starter.promptTemplate({
      template: `Given the following specs, extract requirements for writing an ad copy:
      
      {{specs}}`,
      specs,
    }).prompt,
    context: [],
    path: jsonAgent,
    schema: requirementsSchema,
    generator,
  });

  const adWriter = core.invoke({
    $id: "adWriter",
    text: `Write ad copy that conforms to the requirements above`,
    context: requirementsExtractor,
    schema: adSchema,
    path: jsonAgent,
    generator,
  });

  const customer = core.invoke({
    $id: "customer",
    text: `Imagine you are a customer. You are a middle-aged homeowner from rural Midwest. You are overrun with ads and are weary of being scammed. You just want to work with someone local and trustworty. Review this and offer three improvements that would increase the likelihood of you trusting the ad.`,
    context: adWriter,
    schema: requirementsSchema,
    path: jsonAgent,
    generator,
  });

  const requirementsExtractor2 = core.invoke({
    $id: "requirementsExtractor2",
    text: `Incorporate all feedback above into new, improved requirements`,
    context: customer,
    path: jsonAgent,
    schema: {
      type: "object",
      properties: {
        requirements: {
          type: "array",
          items: {
            type: "string",
            description: "a prompt requirement",
          },
        },
      },
    } satisfies Schema,
    generator,
  });

  const contextRestart = starter.jsonata({
    $id: "contextRestart",
    expression: `$`,
    json: requirementsExtractor2.json.isString(),
  });

  const adWriter2 = core.invoke({
    $id: "adWriter2",
    context: [],
    text: starter.promptTemplate({
      template: `Write ad copy that conforms to the requirements below
      
      {{requirements}}`,
      requirements: contextRestart.result,
    }),
    path: jsonAgent,
    schema: adSchema,
    generator,
  });

  const adExec = core.invoke({
    $id: "adExec",
    text: `You are a Google Ads Search Professional. Given the above prompt and response, generate 3 point constructive critique of the response that I can action to make the output even better and more effective given the prompt.`,
    context: adWriter2,
    path: jsonAgent,
    schema: {
      type: "object",
      properties: {
        critique: {
          type: "array",
          items: {
            type: "string",
            description: "constructive critique point",
          },
        },
      },
    } satisfies Schema,
    generator,
  });

  const improver = core.invoke({
    $id: "improver",
    text: `Given the 3 point critique try to generate a new response.`,
    context: adExec,
    path: jsonAgent,
    schema: adSchema,
    generator,
  });

  // const promptImprover = core.invoke({
  //   text: `Given the original prompt and the extracted requirements, rewrite and enrich the prompt to be more expressive and likely to generate a really engaging and interesting ad.`,
  //   context: requirementsExtractor,
  //   path: jsonAgent,
  //   schema: {
  //     type: "object",
  //     properties: {
  //       prompt: {
  //         type: "string",
  //         description: "new rewritten prompt",
  //       },
  //     },
  //   } satisfies Schema,
  //   generator,
  // });
  // const assessor = core.invoke({
  //   text: `Given the list of requirements assess how well the newest response conforms to the requirements.`,
  //   context: requirementsExtractor,
  //   path: jsonAgent,
  //   schema: {
  //     type: "object",
  //     properties: {
  //       assessment: {
  //         type: "array",
  //         items: {
  //           type: "object",
  //           properties: {
  //             summary: {
  //               type: "string",
  //               description: "summary of an point in the assessment",
  //             },
  //             details: {
  //               type: "string",
  //               description: "details of the the assessment point",
  //             },
  //           },
  //         },
  //       },
  //     },
  //   } satisfies Schema,
  //   generator,
  // });

  // const improver2 = core.invoke({
  //   text: `Use the new prompt to write the final ad:`,
  //   context: promptImprover,
  //   path: jsonAgent,
  //   schema: adSchema,
  //   generator,
  // });

  return { ...improver };
}).serialize({
  title: "Data Board",
  description: "A prototype of a conversation of multiple agents",
  version: "0.0.1",
});
