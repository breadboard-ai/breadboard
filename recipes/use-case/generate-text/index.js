/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, recipe, code } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";
import { core } from "@google-labs/core-kit";
import { palm } from "@google-labs/palm-kit";

const metaData = {
  title: "Generate an text response from a prompt",
  description:
    "Generates an text response using PaLM, but can be used with any LLM provider (if the 'provider' is specified.)",
  version: "0.0.3",
};

const generateTextScheme = {
  type: "object",
  properties: {
    prompt: {
      type: "string",
      title: "input",
      description: "What text is used to generate the embedding?",
    },
    provider: {
      type: "string",
      title: "provider",
      description:
        "The URL of the provider board that will generate Text prompt response?",
      default: ".",
    },
  },
  required: ["prompt"],
};

export default await recipe(() => {
  // Either use the default embedding provider or use a custom one (specified by provider)
  const generateTextFactory = code(({ provider, palmRecipe }) => {
    // The provider must return a "text_response"
    if (provider === undefined || provider == ".") {
      return {
        graph: palmRecipe,
      };
    }
    return { path: provider };
  });

  const input = base.input({ $id: "input", schema: generateTextScheme });

  // Because `code` can't return a recipe, we have to create it here and then pass it in.
  const palmRecipe = recipe(({ prompt }) => {
    const secrets = starter.secrets({
      keys: ["PALM_KEY"],
    });
    return prompt.as("text").to(palm.generateText({ PALM_KEY: secrets }));
  }).serialize();

  const generateText = generateTextFactory({
    palmRecipe,
  });

  return input
    .to(generateText)
    .to(
      core.invoke({
        prompt: input.prompt,
      })
    )
    .text.to(base.output({ $id: "text_response" }));
}).serialize(metaData);
