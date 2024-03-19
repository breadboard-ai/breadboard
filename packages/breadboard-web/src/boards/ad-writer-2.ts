/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, base, board, code } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";

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
  },
} satisfies Schema;

type AdCampaign = {
  adCampaign: {
    headlines: string[];
    descriptions: string[];
  };
};

// const adSchema = {
//   type: "object",
//   properties: {
//     headline: {
//       type: "string",
//       description: "a headline that fits into the 30 character limit",
//     },
//     description: {
//       type: "string",
//       description: "a description that fits into the 90 character limit",
//     },
//   },
// } satisfies Schema;

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

const extractPrompt = code(({ json }) => {
  const { prompt } = json as { prompt: string };
  return { prompt };
});

const extractJson = code(({ context }) => {
  const list = (context as ContextItem[]) || [];
  const last = list[list.length - 1];
  const json = JSON.parse(last.parts.text);
  return { json };
});

type ContextItem = {
  role: string;
  parts: { text: string };
};

/**
 * Will check character limits and insert a special prompt
 * if the limits are exceeded.
 */
const checkCharacterLimits = code(({ context }) => {
  const list = (context as ContextItem[]) || [];
  const last = list[list.length - 1] as ContextItem;
  const json = JSON.parse(last.parts.text);
  const { adCampaign } = json as AdCampaign;
  const warning = [
    `You are a brilliant copy editor who is famous brevity, making ads in the ad campaign fit into the character limits while retaining their meaning and impact. Given the ad, follow instructions below:`,
  ];
  for (const headline of adCampaign.headlines) {
    if (headline.length > 30) {
      warning.push(
        `The headline "${headline}" is ${headline.length} characters long, but needs to be 30 characters. Shorten it.`
      );
    }
  }
  for (const description of adCampaign.descriptions) {
    if (description.length > 90) {
      warning.push(
        `The description "${description}" is ${description.length} characters long, but needs to be 90 characters. Shorten it.`
      );
    }
  }
  if (warning.length > 1) {
    return { warning: warning.join("\n\n") };
  }
  return { context };
});

const refineAd = board(({ context }) => {
  const limitChecker = checkCharacterLimits({
    $metadata: {
      title: "Character Limit Checker",
    },
    context: context,
  });

  const shortener = agents.structuredWorker({
    $metadata: {
      title: "Ad Shortener",
    },
    instruction: limitChecker.warning,
    context,
    schema: adCampaignSchema,
  });

  base.output({
    $metadata: {
      title: "Successful exit",
    },
    exit: limitChecker.context,
  });

  return { context: shortener.context };
});

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

  const customerPromptMaker = agents.structuredWorker({
    $metadata: {
      title: "Customer Prompt Maker",
      description: "Conjuring up a persona to represent a customer",
      logLevel: "info",
    },
    instruction: `Using the audience information in the search engine marketing overview, create a prompt for a bot who will pretend to be the target audience for the ad. The prompt needs to incorporate the sense of skepticism and weariness of ads, yet willingness to provide constructive feedback. The prompt needs to be in the form of:
    
    "You are [persona]. You are [list of traits]."`,
    schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "the prompt for the bot",
        },
      },
    },
    context,
  });

  const adWriter = agents.structuredWorker({
    $metadata: {
      title: "Ad Writer",
    },
    instruction: `Write an ad campaign (up to 15 headlines and and 4 descriptions) and that transforms the search engine marketing overview into a compelling, engaging ad.`,
    context,
    schema: adCampaignSchema,
  });

  const promptExtractor = extractPrompt({
    $metadata: {
      title: "Prompt Extractor",
    },
    json: customerPromptMaker.json,
  });

  const customer = agents.structuredWorker({
    $metadata: {
      title: "Customer",
    },
    instruction: promptExtractor.prompt,
    context: adWriter.context,
    schema: requirementsSchema,
  });

  const editor = agents.structuredWorker({
    $metadata: {
      title: "Ad Editor",
    },
    instruction: `Given the customer critique, update the ad campaign. Make sure to conform to the requirements in the Search Engine Marketing document. Remove any uses of the word "free".`,
    context: customer,
    schema: adCampaignSchema,
  });

  const adRefinery = agents.repeater({
    $metadata: {
      title: "Ad refinery",
    },
    context: editor.context,
    worker: refineAd,
    max: 4,
  });

  const jsonExtractor = extractJson({
    $metadata: {
      title: "JSON Extractor",
    },
    context: adRefinery.context,
  });

  return { context: adRefinery.context, json: jsonExtractor.json };
}).serialize({
  title: "Ad Writer (variant 2)",
  description: "An example of chain of agents working on writing an ad",
  version: "0.0.2",
});
