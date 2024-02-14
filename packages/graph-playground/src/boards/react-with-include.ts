/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { TemplateKit } from "@google-labs/template-kit";
import { ReActHelper } from "../react.js";
import { Core } from "@google-labs/core-kit";
import { PaLMKit } from "@google-labs/palm-kit";

const board = new Board();
const core = board.addKit(Core);
const kit = board.addKit(TemplateKit);
const reAct = board.addKit(ReActHelper);
const palm = board.addKit(PaLMKit);

/**
 * This is a slight improvement on the plain (see `react.ts`) ReAct
 * implementation. Mostly meant as an illustration.
 *
 * See `react-with-slot.ts` for a more elegant implementation.
 */

// A URL to a repository containing various saved breadboard layouts.
const REPO_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/graph-playground/graphs";

// The single node where all the important keys come from.
const secrets = core.secrets({
  keys: ["PALM_KEY", "GOOGLE_CSE_ID"],
});

// This is the main ingredient: the template that makes the algo tick.
const reActTemplate = kit
  .promptTemplate({
    template:
      "Answer the following questions as best you can. You have access to the " +
      "following tools:\n\n{{descriptions}}\n\nUse the following " +
      "format:\n\nQuestion: the input question you must answer\nThought: you " +
      "should always think about what to do\nAction: the action to take, " +
      "should be one of: {{tools}}\nAction Input: the input to the action\n" +
      "Observation: the result of the action\n... " +
      "(this Thought/Action/Action Input/Observation can repeat N times)\n" +
      "Thought: I now know the final answer\nFinal Answer: the final answer to " +
      "the original input question\n\nBegin!\n\n{{memory}}\nThought:",
  })
  .wire("<-descriptions.", reAct.getDescriptions())
  .wire("<-tools.", reAct.getTools());

/**
 * The following three nodes form the "memory" of the ReAct algo.
 * The are built out of the `append` node, which is a powerful tool
 * for accumulating information.
 *
 * We need three nodes to orchestrate the proper ordering of the memory:
 * - First, we need to remember the question.
 * - Second, we need to remember the thought.
 * - Thirs, we need to remember the observation.
 *
 * The second and third are remembered repeatedly in the ReAct algo cycle.
 *
 * Graphs are generally orderless, so extra work is necessary to make this
 * ordering happen.
 */

// When the observation arrives from the tools, we use this node
// to append it to the memory.
// This node wires directly to the `reActTemplate` node,
// since it's at the end of our order.
const rememberObservation = core
  .append({ $id: "rememberObservation" })
  .wire("accumulator->memory", reActTemplate);

// When the thought arrives from the completion, we use this node
// to append it to the memory.
// Notice how the `accumulator` is wired in a cycle with the
// `rememberObservation` node. This is what allows ordering in a cycle.
const rememberThought = core
  .append({ $id: "rememberThought" })
  .wire("accumulator->", rememberObservation)
  .wire("accumulator<-", rememberObservation);

// When the question arrives from the input, we use this node
// to append it to the memory.
// We wire its accumulator to `rememberThought`, so that
// the `rememberThought` node has an initial accumulator value.
// We also wire its accumulator to the `reActTemplate` node for the same
// reason: when the first iteration starts, there aren't any thoughts or
// observations yet.
const rememberQuestion = core
  .append({ $id: "rememberQuestion" })
  .wire("accumulator->", rememberThought)
  .wire("accumulator->memory", reActTemplate);

// Wire input to the `rememberQuestion` node, to provide the question to
// remember.
board
  .input({
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Question",
          description: "Ask ReAct a question",
        },
      },
      required: ["text"],
    },
  })
  .wire("text->Question", rememberQuestion);

// The completion must include stop sentences, to prevent LLM form hallucinating
// all answers.
const reActCompletion = palm
  .generateText({
    stopSequences: ["\nObservation"],
    $id: "react-completion",
  })
  .wire("<-PALM_KEY.", secrets);

// Wire up the math tool by including the `math.json` graph.
const math = core
  .include({ path: `${REPO_URL}/math.json` })
  .wire("text->Observation", rememberObservation);

// Wire up the search tool by including the `search-summarize.ts` graph.
const search = core
  .include({ path: `${REPO_URL}/search-summarize.json` })
  .wire("text->Observation", rememberObservation);

reActTemplate.wire(
  "prompt->text",
  reActCompletion
    .wire(
      "completion->",
      reAct
        .parseCompletion()
        .wire("search->text", search)
        .wire("math->text", math)
        .wire("answer->text", board.output())
    )
    .wire("completion->Thought", rememberThought)
);

export default board;
