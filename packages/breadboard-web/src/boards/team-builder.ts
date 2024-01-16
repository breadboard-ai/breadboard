/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";

const metadata = {
  title: "Team Builder",
  description: "Build a team of experts",
  version: "0.0.1",
};

const jobDescriptionsSchema = {
  type: "object",
  properties: {
    descriptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "expert's title",
          },
          responsibilities: {
            type: "array",
            items: {
              type: "string",
              description: "expert's responsibilities",
            },
          },
        },
      },
    },
  },
} satisfies Schema;

const workflowSchema = {
  type: "object",
  properties: {
    workflow: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "an expert from whom the work is passed",
          },
          to: {
            type: "string",
            description: "an expert to whom the work is passed",
          },
        },
      },
    },
  },
} satisfies Schema;

export default await recipe(({ purpose, generator }) => {
  purpose
    .title("Purpose")
    .examples(
      "Create high quality rhyming poems that will be used as lyrics for jingles in TV commercials. Creating melodies and producing music is not part of job."
    )
    .format("multiline");
  generator.title("Generator").examples("/graphs/gemini-generator.json");

  const jobDescriptions = core.invoke({
    $id: "jobDescriptions",
    path: "json-agent.json",
    schema: jobDescriptionsSchema,
    context: [],
    generator,
    text: starter.promptTemplate({
      $id: "jobDescriptionsPrompt",
      template: `You are building a team of expert LLM-based agents for the following purpose:
      
{{purpose}}

These expert agents can only read text and produce text. The experts will work as a team, collaborating, creating, reviewing, critiquing, and iteratively improving the quality of the poems.

Please identify the necessary job descriptions of these experts.`,
      purpose,
    }).prompt,
  });

  const workflow = core.invoke({
    $id: "workflow",
    path: "json-agent.json",
    context: jobDescriptions.context,
    schema: workflowSchema,
    generator,
    text: starter.promptTemplate({
      $id: "workflowPrompt",
      template: `Now, describe how these agents interact in the form of a workflow. The workflow is defined as a list of pairs of agents. Each pair represents the flow of work from one agent to another.`,
    }).prompt,
  });

  const splitJobDescriptions = starter.jsonata({
    $id: "splitJobDescriptions",
    expression: "descriptions",
    json: jobDescriptions.json.isString(),
  });

  const createPrompts = core.map({
    $id: "createPrompts",
    list: splitJobDescriptions.result.isArray(),
    board: recipe(({ item, generator }) => {
      const promptTemplate = starter.promptTemplate({
        $id: "promptTemplate",
        template: `You are an expert in creating perfect system prompts for LLM agents from job descriptions. Create a prompt for the the following job description: {{item}}
        
Reply in plain text that is ready to paste into the LLM prompt field.
        
PROMPT:`,
        item,
      });
      const generatePrompt = core.invoke({
        $id: "generatePrompt",
        path: generator.isString(),
        text: promptTemplate.prompt,
      });
      return { item: generatePrompt.text };
    }).in({ generator }),
  });

  return { prompts: createPrompts.list, json: workflow.json };
}).serialize(metadata);
