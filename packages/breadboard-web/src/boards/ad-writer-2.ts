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
        type: "object",
        properties: {
          requirement: {
            type: "string",
            description: "the requirement",
          },
          justification: {
            type: "string",
            description: "reasoning behind including this requirement",
          },
        },
      },
    },
  },
} satisfies Schema;

const reqiurementsReviewSchema = {
  type: "object",
  properties: {
    requirementsReview: {
      type: "array",
      items: {
        type: "object",
        properties: {
          requirement: {
            type: "string",
            description: "the requirement",
          },
          problem: {
            type: "string",
            description: "why can't it be satisfied",
          },
        },
      },
    },
  },
} satisfies Schema;

export default await board(({ context }) => {
  context
    .title("Ad specs")
    .format("multiline")
    .examples(
      `Write an ad for Breadboard. The ad must incorporate the following key messages: 
      - Breadboard for Developers
      - Iterate with Gemini APIs 
      - Integrate AI Into Your Project
      - Start Your AI Project Today
      - Create graphs with prompts
      - AI for Developers
      - Try Google Gemini`
    );

  const adWriter = agents.structuredWorker({
    $metadata: {
      title: "Ad Writer",
    },
    instruction: `Write ad copy that incorporates the key messages in the ad spec into a compelling, engaging ad for Google AdWords service, staying within the 300 character limit.`,
    context,
    schema: adSchema,
  });

  const adExec = agents.structuredWorker({
    $metadata: {
      title: "Ad Writing Pro",
    },
    instruction: `You are a Google Ads Search Professional. Given the above prompt and response, generate 3 point constructive critique of the response that I can action to make the output even better and more effective given the prompt.`,
    context: adWriter,
    schema: {
      type: "object",
      properties: {
        critique: {
          type: "array",
          items: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "summary of a point in the critique",
              },
              details: {
                type: "string",
                description: "reasoning behind the point in a critique",
              },
              suggestions: {
                type: "string",
                description: "suggestions for improvement",
              },
            },
          },
        },
      },
    } satisfies Schema,
  });

  const improver1 = agents.structuredWorker({
    $metadata: {
      title: "Ad Improveer",
    },
    context: adExec.context,
    instruction: `Write ad copy that incorporates the 3 points in the critique into a new, improved ad for Google AdWords service.`,
    schema: adSchema,
  });

  const customer = agents.structuredWorker({
    $metadata: {
      title: "Customer",
    },
    instruction: `Imagine you are a customer. You are a software developer who is overrun with ads and are weary of all the hype around AI. You just want to get going and get something done. Review the ad and offer three improvements that would increase the likelihood of you trusting it.`,
    context: improver1,
    schema: requirementsSchema,
  });

  const requirementsExtractor = agents.structuredWorker({
    $metadata: {
      title: "Requirements Extractor",
    },
    instruction: `Incorporate all feedback above into new, improved requirements. If the feedback can not be satisfied because it's not in the original ad spec, think of ways of how it could be addressed`,
    context: customer,
    schema: requirementsSchema,
  });

  const requirementsReviewer = agents.structuredWorker({
    $metadata: {
      title: "Requirements Rewriter",
    },
    instruction: `Look at the requirements and compare them with the content of the original ad spec. Does the content of the ad spec contain information necessary to satisfy the requiremnts?`,
    context: requirementsExtractor,
    schema: reqiurementsReviewSchema,
  });

  const requirementsExtractor2 = agents.structuredWorker({
    $metadata: {
      title: "Requirements Extractor",
    },
    instruction: `Update the requirements based on the review, removing or adjusting the requirements that can't be satisfied`,
    context: requirementsReviewer,
    schema: requirementsSchema,
  });

  const adWriter2 = agents.structuredWorker({
    $metadata: {
      title: "Ad Writer",
    },
    context: requirementsExtractor2.context,
    instruction: `Write ad copy that conforms to the specified requirements, shortening it to fit into the 300 character limit of the ad platform.`,
    schema: adSchema,
  });

  // const improver = agents.structuredWorker({
  //   $metadata: {
  //     title: "Ad Editor",
  //   },
  //   instruction: `Given the 3 point critique try to generate a new response.`,
  //   context: adExec,
  //   schema: adSchema,
  // });

  // const assessor = agents.structuredWorker({
  //   $metadata: {
  //     title: "Ad Evaluator",
  //   },
  //   instruction: `Given the list of requirements assess how well the newest response conforms to the requirements.`,
  //   context: improver.context,
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
  //               description: "reasoning behind the point in an assessment",
  //             },
  //           },
  //         },
  //       },
  //     },
  //   } satisfies Schema,
  // });

  // const improver2 = agents.structuredWorker({
  //   $metadata: {
  //     title: "Ad Editor",
  //   },
  //   instruction: `You are a Google Ads Professional. Write the ad copy that satisfies the requirements and is improved based on the assessment`,
  //   context: assessor.context,
  //   schema: adSchema,
  // });

  return { ...adWriter2 };
}).serialize({
  title: "Ad Writer (variant 2)",
  description: "An example of chain of agents working on writing an ad",
  version: "0.0.1",
});
