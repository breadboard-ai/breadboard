/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { ReActHelper } from "../react.js";

const board = new Board();
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

// This is the context that ReAct algo accumulates.
const context = kit.localMemory();

// This is the main ingredient: the template that makes the algo tick.
const reActTemplate = kit
  .textTemplate(
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
  .wire("<-tools.", reAct.getTools())
  .wire("memory<-context", context);

// The completion must include stop sentences, to prevent LLM form hallucinating
// all answers.
const reActCompletion = kit
  .textCompletion({
    "stop-sequences": ["\nObservation"],
    $id: "react-completion",
  })
  .wire("<-PALM_KEY.", secrets);

// Wire up the math tool. This code mostly matches what is in
// `math.ts`, but is now participating in the larger ReAct board.
const math = kit
  .textTemplate(
    "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
    { $id: "math-function" }
  )
  .wire(
    "prompt->text",
    kit
      .textCompletion({ $id: "math-function-completion" })
      .wire(
        "completion->code",
        kit
          .runJavascript("compute", { $id: "compute" })
          .wire("result->Observation", context)
      )
      .wire("<-PALM_KEY.", secrets)
  );

// Wire up the search tool. This code is mostly the same as in
// `search-summarize.ts`, with tweaks to play nice in the ReAct board.
const search = () => {
  const completion = kit
    .textCompletion()
    .wire("completion->Observation", context)
    .wire("<-PALM_KEY.", secrets);

  const summarizingTemplate = kit
    .textTemplate(
      "Use context below to answer this question:\n\n##Question:\n{{question}}\n\n## Context {{context}}\n\\n## Answer:\n",
      { $id: "summarizing-template" }
    )
    .wire("prompt->text", completion);
  const searchURLTemplate = kit
    .urlTemplate(
      "https://www.googleapis.com/customsearch/v1?key={{PALM_KEY}}&cx={{GOOGLE_CSE_ID}}&q={{query}}"
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

  return board
    .passthrough()
    .wire("search->question", summarizingTemplate)
    .wire("search->query", searchURLTemplate);
};

board
  .input("Ask ReAct a question")
  .wire(
    "text->Question",
    kit
      .localMemory({ $id: "remember-question" })
      .wire(
        "context->memory",
        reActTemplate.wire(
          "prompt->text",
          reActCompletion
            .wire(
              "completion->",
              reAct
                .parseCompletion(["completion"])
                .wire("search->", search())
                .wire("math->question", math)
                .wire("answer->text", board.output())
            )
            .wire(
              "completion->Thought",
              kit.localMemory({ $id: "remember-thought" })
            )
        )
      )
  );

export default board;
