// In a recent business report presentation, the CEO of Zana Corp. highlighted their remarkable growth in the past fiscal year. She shared that the company experienced a 15% increase in revenue, reaching $50 million, with a 12% profit margin ($6 million in net profit). The report also showcased a 20% growth in their customer base, now totaling 100,000 customers. Additionally, the company's operating expenses went up by 10%, amounting to $10 million, while the employee headcount increased by 25%, resulting in a current workforce of 500 employees.

// Generate a table containing this information:

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { palm } from "@google-labs/palm-kit";
import { templates } from "@google-labs/template-kit";

const metaData = {
  title: "Generate a prompt response using a few-shot template",
  description: "Generate a prompt response using a few-shot template.",
  version: "0.0.3",
};

const queryScheme = {
  type: "object",
  properties: {
    few: {
      type: "array",
      title: "few",
      description: "What are the examples?",
      items: {
        type: "string",
      },
    },
    promptText: {
      type: "string",
      title: "promptText",
      description: "What is the prompt?",
    },
  },
  required: ["information"],
};

export default await board(() => {
  const input = base.input({ $id: "input", schema: queryScheme });
  const secrets = core.secrets({
    keys: ["PALM_KEY"],
  });

  const fewText = input.to(
    code(({ few }) => {
      return { few: few.join("\n") };
    })()
  );

  const prompt = templates.promptTemplate({
    template: "{{few}}\n{{promptText}}",
  });

  fewText.few.to(prompt);

  return input.promptText
    .to(prompt)
    .prompt.as("text")
    .to(
      palm.generateText({
        PALM_KEY: secrets,
      })
    )
    .response.to(base.output({ $id: "fewShotOutput" }));
}).serialize(metaData);
