/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, code, recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { json } from "@google-labs/json-kit";

const sampleAgent = "/graphs/ad-writer.json";
const jsonAgent = "/graphs/json-agent.json";

export default await recipe(({ agent, context, text, n }) => {
  text
    .title("Task")
    .description("The task to perform")
    .format("multiline")
    .examples(
      `This ad is for my lawn care company that will fit into an inch of newspaper copy. It's called "Max's Lawn Care" and it should use the slogan "I care about your lawn." Emphasize the folksiness of it being a local, sole proprietorship that I started after graduating from high school.`
    );
  agent
    .title("Agent")
    .description("Agent to apply to the task")
    .examples(sampleAgent);
  context.title("Context").isArray().examples("[]");
  n.title("Number of parallel attemps").isNumber().examples("4");

  const createList = code(({ n }) => {
    return { list: [...Array(n).keys()] };
  })({ $id: "createList", n });

  const generateN = core.map({
    $id: "generateN",
    board: recipe(({ text, agent }) => {
      const invokeAgent = core.invoke({
        $id: "invokeAgent",
        text,
        context: [],
        path: agent.isString(),
      });
      return { item: invokeAgent.json };
    }).in({ agent, text }),
    list: createList.list,
  });

  const makeNicerList = json.jsonata({
    $id: "presentChoices",
    expression: `item ~> $map(function ($v, $i) { { "title": "choice " & $i, "content": $v } })`,
    json: generateN.list.isString(),
  });

  const rank = core.invoke({
    $id: "rank",
    path: jsonAgent,
    text: templates.promptTemplate({
      template: `You are a ranking expert. Given {{n}} choices of the output, you are to rank these choices in the order (starting with the best) of matching the requirements of the task described below:
        
        TASK:
        
        {{text}}
        
        CHOICES:
        
        {{list}}`,
      text,
      n,
      list: makeNicerList.result,
    }),
    schema: {
      type: "object",
      properties: {
        ranking: {
          type: "array",
          items: {
            type: "object",
            properties: {
              choice: {
                type: "string",
                description: "Title of ranked choice",
              },
              justification: {
                type: "string",
                description:
                  "Detailed justification of why this is the right position within ranking",
              },
            },
          },
        },
      },
    } satisfies Schema,
    context: [],
  });

  const pickFirst = json.jsonata({
    $id: "pickFirst",
    expression:
      "($index := $split((**.choice)[0], ' ')[1];list[0][0][$index]).item",
    rank: rank.json.isString(),
    list: generateN.list,
  });

  return { best: pickFirst.result, list: generateN.list, rank: rank.json };
}).serialize({
  title: "Best of N",
  description:
    "Apply the `agent` to `task` in parallel of `n` attempts, then return the best response that fits the task",
  version: "0.0.2",
});
