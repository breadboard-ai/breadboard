/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { agents } from "@google-labs/agent-kit";
import { Schema, board } from "@google-labs/breadboard";

const adCampaignSchema = {
  type: "object",
  properties: {
    adCampaign: {
      type: "object",
      description: "the ad campaign",
      properties: {
        headlines: {
          type: "array",
          items: {
            type: "string",
            description:
              "an ad headline (30 character limit, up to 15 headlines)",
          },
        },
        descriptions: {
          type: "array",
          items: {
            type: "string",
            description:
              "the  description (90 character limit, up to 4 descriptions)",
          },
        },
      },
    },
    voteRequest: {
      type: "string",
      description:
        "A request to the user to evaluate the ad campaign and decide if it's good (yes or no).",
    },
  },
} satisfies Schema;

const adExample = `Write an ad for Breadboard. The ad must incorporate the following key messages: 
- Breadboard for Developers
- Play and experiment with AI Patterns
- Prototype quickly
- Use with Gemini APIs 
- Integrate AI Into Your Project
- Create graphs with prompts
- Accessible AI for Developers`;

export default await board(({ context }) => {
  context.title("Ad specs").format("multiline").examples(adExample);

  const writer = agents.structuredWorker({
    $metadata: {
      title: "Ad Writer",
    },
    instruction: `Write an ad campaign (up to 15 headlines and and 4 descriptions) and that transforms the search engine marketing overview into a compelling, engaging ad.`,
    context,
    schema: adCampaignSchema,
  });

  const humanVoter = agents.human({
    $metadata: { title: "Human Voter" },
    context: writer.context,
  });

  humanVoter.again.as("context").to(writer);

  return { text: humanVoter.context };
}).serialize({
  title: "Human Feedback Test Bench",
  description:
    "A test for various forms of human feedback, using the `Human` node from the Agent Kit",
  version: "0.0.1",
});
