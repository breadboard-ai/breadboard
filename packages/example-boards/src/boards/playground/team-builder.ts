/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";
import { agents } from "@google-labs/agent-kit";

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

export default await board(({ purpose }) => {
  purpose
    .title("Purpose")
    .examples(
      "Create high quality rhyming poems that will be used as lyrics for jingles in TV commercials. Creating melodies and producing music is not part of job."
    )
    .format("multiline");

  const jobDescriptions = agents.structuredWorker({
    $id: "jobDescriptions",
    schema: jobDescriptionsSchema,
    context: purpose,
    instruction: `You are building a team of expert LLM-based agents a specific purpose.

These expert agents can only read text and produce text. The experts will work as a team, collaborating, creating, reviewing, critiquing, and iteratively improving the quality of the poems.

Please identify the necessary job descriptions of these experts.`,
  });

  const workflow = agents.structuredWorker({
    $id: "workflow",
    context: jobDescriptions.context,
    schema: workflowSchema,
    instruction: `Now, describe how these agents interact in the form of a workflow. The workflow is defined as a list of pairs of agents. Each pair represents the flow of work from one agent to another.`,
  });

  const splitJobDescriptions = json.jsonata({
    $id: "splitJobDescriptions",
    expression: "descriptions",
    json: jobDescriptions.json.isString(),
  });

  const createPrompts = core.map({
    $id: "createPrompts",
    list: splitJobDescriptions.result.isArray(),
    board: board(({ item }) => {
      const generatePrompt = agents.structuredWorker({
        $id: "generatePrompt",
        instruction: `You are an expert in creating perfect system prompts for LLM agents from job descriptions. Create a prompt for the the following job description`,
        context: item,
        schema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "the prompt for the job description",
            },
          },
        } satisfies Schema,
      });
      return { item: generatePrompt.json };
    }),
  });

  return { prompts: createPrompts.list, json: workflow.json };
}).serialize(metadata);
