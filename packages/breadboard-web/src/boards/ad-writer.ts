/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, board } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";

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

export default await board(({ context }) => {
  context
    .title("Ad specs")
    .format("multiline")
    .examples(
      `This ad is for my lawn care company that will fit into an inch of newspaper copy. It's called "Max's Lawn Care" and it should use the slogan "I care about your lawn." Emphasize the folksiness of it being a local, sole proprietorship that I started after graduating from high school.`
    );

  const requirementsExtractor = agents.structuredWorker({
    $id: "requiremenstExtractor",
    context,
    instruction: `Given the following specs, extract requirements for writing an ad copy`,
    schema: requirementsSchema,
  });

  const adWriter = agents.structuredWorker({
    $id: "adWriter",
    instruction: `Write ad copy that conforms to the requirements above`,
    context: requirementsExtractor,
    schema: adSchema,
  });

  const customer = agents.structuredWorker({
    $id: "customer",
    instruction: `Imagine you are a customer. You are a middle-aged homeowner from rural Midwest. You are overrun with ads and are weary of being scammed. You just want to work with someone local and trustworty. Review this and offer three improvements that would increase the likelihood of you trusting the ad.`,
    context: adWriter,
    schema: requirementsSchema,
  });

  const requirementsExtractor2 = agents.structuredWorker({
    $id: "requirementsExtractor2",
    instruction: `Incorporate all feedback above into new, improved requirements`,
    context: customer,
    schema: requirementsSchema,
  });

  const adWriter2 = agents.structuredWorker({
    $id: "adWriter2",
    context: requirementsExtractor2.context,
    instruction: `Write ad copy that conforms to the specified requirements`,
    schema: adSchema,
  });

  const adExec = agents.structuredWorker({
    $id: "adExec",
    instruction: `You are a Google Ads Search Professional. Given the above prompt and response, generate 3 point constructive critique of the response that I can action to make the output even better and more effective given the prompt.`,
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

  const improver = agents.structuredWorker({
    $id: "improver",
    instruction: `Given the 3 point critique try to generate a new response.`,
    context: adExec,
    schema: adSchema,
  });

  const assessor = agents.structuredWorker({
    $id: "assessor",
    instruction: `Given the list of requirements assess how well the newest response conforms to the requirements.`,
    context: improver.context,
    schema: {
      type: "object",
      properties: {
        assessment: {
          type: "array",
          items: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "summary of an point in the assessment",
              },
              details: {
                type: "string",
                description: "reasoning behind the point in an assessment",
              },
            },
          },
        },
      },
    } satisfies Schema,
  });

  const improver2 = agents.structuredWorker({
    $id: "improver2",
    instruction: `You are a Google Ads Professional. Write the ad copy that satisfies the requirements and is improved based on the assessment`,
    context: assessor.context,
    schema: adSchema,
  });

  return { ...improver2 };
}).serialize({
  title: "Ad Writer",
  description: "An example of chain of agents working on writing an ad",
  version: "0.0.3",
});
