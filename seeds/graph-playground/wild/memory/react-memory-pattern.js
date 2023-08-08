/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { config } from "dotenv";

import { memoryPatternOne } from "./memory-pattern.js";

config();

const board = new Board();
const kit = board.addKit(Starter);

/**
 * This another iteration on the original (`react.ts`) ReAct
 * implementation, building on `react-with-include.ts`.
 * This one uses jsonata instead of a custom node.
 *
 * The key trick is the addition of the `reflect` node that allows
 * the graph to be introspected. This node returns a JSON representation
 * of the graph, which is then manipulated with the `jsonata` nodes.
 *
 * See `react-with-slot.ts` for a more elegant implementation.
 */

// A URL to a repository containing various saved breadboard layouts.
const REPO_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs";

// The single node where all the important keys come from.
const secrets = kit.secrets(["PALM_KEY", "GOOGLE_CSE_ID"]);

// This is the jsonata node that extracts the tool names
// from the reflected graph.
const tools = kit.jsonata(
  "nodes.configuration.description.%.%.[id] ~> $join(', ')"
);

// This is the jsonata node that extracts the tool descriptions
// from the reflected graph.
const descriptions = kit.jsonata(
  "nodes.configuration.description.%.%.[id &  ': ' & configuration.description] ~> $join('\n')"
);

board.reflect().wire("graph->json", tools).wire("graph->json", descriptions);

// This is the main ingredient: the template that makes the algo tick.
const reActTemplate = kit
  .promptTemplate(
    "Answer the following questions as best you can. You have access to the " +
      "following tools:\n\n{{descriptions}}\n\nUse the following " +
      "format:\n\nQuestion: the input question you must answer\nThought: you " +
      "should always think about what to do\nAction: the action to take, " +
      "should be one of: {{tools}}\nAction Input: the input to the action\n" +
      "Observation: the result of the action\n... " +
      "(this Thought/Action/Action Input/Observation can repeat N times)\n" +
      "Thought: I now know the final answer\nFinal Answer: the final answer to " +
      "the original input question\n\nBegin!\n\n{{memory}}\nThought:"
  )
  .wire("descriptions<-result.", descriptions)
  .wire("tools<-result.", tools);

const {
  first: rememberQuestion,
  second: rememberThought,
  third: rememberObservation,
} = memoryPatternOne(kit, reActTemplate);

// Wire input to the `rememberQuestion` node, to provide the question to
// remember.
board.input("Ask ReAct a question").wire("text->Question", rememberQuestion);

// The completion must include stop sentences, to prevent LLM form hallucinating
// all answers.
const reActCompletion = kit
  .generateText({
    stopSequences: ["\nObservation"],
    $id: "react-completion",
  })
  .wire("<-PALM_KEY.", secrets);

// Wire up the math tool by including the `math.json` graph.
// An important addition is the `$id` and `description` fields.
// These fields plant the necessary information into the graph
// so that then this information could be extracted with `jsonata` nodes.
const math = board
  .include(`${REPO_URL}/math.json`, {
    $id: "math",
    description:
      "Useful for when you need to solve math problems. Input should be a math problem to be solved.",
  })
  .wire("text->Observation", rememberObservation);

// Wire up the search tool by including the `search-summarize.ts` graph.
// Similarly to above, the `$id` and `description` fields are added to
// communicate the purpose of this node.
const search = board
  .include(`${REPO_URL}/search-summarize.json`, {
    $id: "search",
    description:
      "Useful for when you need to find facts. Input should be a search query.",
  })
  .wire("text->Observation", rememberObservation);

reActTemplate.wire(
  "prompt->text",
  reActCompletion
    .wire(
      "completion->json",
      kit
        .jsonata(
          "($f := function($line, $str) { $contains($line, $str) ? $substring($line, $length($str)) }; $merge(($split('\n')[[1..2]]) @ $line.$.{'action': $f($line, 'Action: '), 'input': $f($line, 'Action Input: '),'answer': $f($line, 'Final Answer: ') }).{ action: input,'answer': answer})",
          {
            raw: true,
          }
        )
        .wire("search->text", search)
        .wire("math->text", math)
        .wire("answer->text", board.output())
    )
    .wire("completion->Thought", rememberThought)
);

// Run the breadboard.
const outputs = await board.runOnce({
  text: "What's the square root of the number of holes on a typical breadboard?",
});
console.log("output", outputs.text);
