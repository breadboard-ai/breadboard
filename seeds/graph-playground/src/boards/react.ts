/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { ReActHelper } from "../react.js";
import { Core } from "@google-labs/core-kit";

const board = new Board();
const core = board.addKit(Core);
const kit = board.addKit(Starter);
const reAct = board.addKit(ReActHelper);

/**
 * This is a plain ReAct implementation. It's very verbose, and is meant
 * more as an illustration of how to wire complex boards and how to use
 * custom nodes.
 * Basically, without `include` and `slot`, this is what you get.
 * See `react-with-slot.ts` for a more elegant implementation.
 */

// The single node where all the important keys come from.
const secrets = kit.secrets(["PALM_KEY", "GOOGLE_CSE_ID"]);

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
const rememberObservation = kit
  .append({ $id: "rememberObservation" })
  .wire("accumulator->memory", reActTemplate);

// When the thought arrives from the completion, we use this node
// to append it to the memory.
// Notice how the `accumulator` is wired in a cycle with the
// `rememberObservation` node. This is what allows ordering in a cycle.
const rememberThought = kit
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
const rememberQuestion = kit
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
const reActCompletion = kit
  .generateText({
    stopSequences: ["\nObservation"],
    $id: "react-completion",
  })
  .wire("<-PALM_KEY.", secrets);

// Wire up the math tool. This code mostly matches what is in
// `math.ts`, but is now participating in the larger ReAct board.
const math = kit
  .promptTemplate(
    "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
    { $id: "math-function" }
  )
  .wire(
    "prompt->text",
    kit
      .generateText({ $id: "math-function-completion" })
      .wire(
        "completion->code",
        kit
          .runJavascript("compute", { $id: "compute" })
          .wire("result->Observation", rememberObservation)
      )
      .wire("<-PALM_KEY.", secrets)
  );

// Wire up the search tool. This code is mostly the same as in
// `search-summarize.ts`, with tweaks to play nice in the ReAct board.
const search = () => {
  const completion = kit
    .generateText()
    .wire("completion->Observation", rememberObservation)
    .wire("<-PALM_KEY.", secrets);

  const summarizingTemplate = kit
    .promptTemplate(
      "Use context below to answer this question:\n\n##Question:\n{{question}}\n\n## Context {{context}}\n\\n## Answer:\n",
      { $id: "summarizing-template" }
    )
    .wire("prompt->text", completion);
  const searchURLTemplate = kit
    .urlTemplate(
      "https://www.googleapis.com/customsearch/v1?key={PALM_KEY}&cx={GOOGLE_CSE_ID}&q={query}"
    )
    .wire("<-PALM_KEY.", secrets)
    .wire("<-GOOGLE_CSE_ID.", secrets)
    .wire(
      "url",
      kit
        .fetch()
        .wire(
          "response->json",
          kit
            .jsonata("$join(items.snippet, '\n')")
            .wire("result->context", summarizingTemplate)
        )
    );

  return core
    .passthrough()
    .wire("search->question", summarizingTemplate)
    .wire("search->query", searchURLTemplate);
};

reActTemplate.wire(
  "prompt->text",
  reActCompletion
    .wire(
      "completion->",
      reAct
        .parseCompletion()
        .wire("search->", search())
        .wire("math->question", math)
        .wire("answer->text", board.output())
    )
    .wire("completion->Thought", rememberThought)
);

export default board;
