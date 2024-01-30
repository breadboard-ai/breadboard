/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { json } from "@google-labs/json-kit";

const jsonAgent = "json-agent.json";

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

export default await board(({ text }) => {
  text
    .title("Ad specs")
    .format("multiline")
    .examples(
      `This ad is for my lawn care company that will fit into an inch of newspaper copy. It's called "Max's Lawn Care" and it should use the slogan "I care about your lawn." Emphasize the folksiness of it being a local, sole proprietorship that I started after graduating from high school.`
    );

  const requirementsExtractor = core.invoke({
    $id: "requiremenstExtractor",
    path: jsonAgent,
    text: templates.promptTemplate({
      template: `Given the following specs, extract requirements for writing an ad copy:

      {{text}}`,
      text,
    }).prompt,
    context: [],
    schema: requirementsSchema,
  });

  const adWriter = core.invoke({
    $id: "adWriter",
    path: jsonAgent,
    text: `Write ad copy that conforms to the requirements above`,
    context: requirementsExtractor,
    schema: adSchema,
  });

  const customer = core.invoke({
    $id: "customer",
    path: jsonAgent,
    text: `Imagine you are a customer. You are a middle-aged homeowner from rural Midwest. You are overrun with ads and are weary of being scammed. You just want to work with someone local and trustworty. Review this and offer three improvements that would increase the likelihood of you trusting the ad.`,
    context: adWriter,
    schema: requirementsSchema,
  });

  const requirementsExtractor2 = core.invoke({
    $id: "requirementsExtractor2",
    path: jsonAgent,
    text: `Incorporate all feedback above into new, improved requirements`,
    context: customer,
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
  });

  // TODO: Do something more componenty here. Is restarting context a board?
  const contextRestart = json.jsonata({
    $id: "contextRestart",
    expression: `$`,
    json: requirementsExtractor2.json.isString(),
  });

  const adWriter2 = core.invoke({
    $id: "adWriter2",
    path: jsonAgent,
    context: [],
    text: templates.promptTemplate({
      template: `Write ad copy that conforms to the requirements below

      {{requirements}}`,
      requirements: contextRestart.result,
    }),
    schema: adSchema,
  });

  const adExec = core.invoke({
    $id: "adExec",
    path: jsonAgent,
    text: `You are a Google Ads Search Professional. Given the above prompt and response, generate 3 point constructive critique of the response that I can action to make the output even better and more effective given the prompt.`,
    context: adWriter2,
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
  });

  const improver = core.invoke({
    $id: "improver",
    path: jsonAgent,
    text: `Given the 3 point critique try to generate a new response.`,
    context: adExec,
    schema: adSchema,
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
  title: "Ad Writer",
  description: "An example of chain of agents working on writing an ad",
  version: "0.0.2",
});
