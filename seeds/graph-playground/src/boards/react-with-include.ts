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
 * This is a slight improvement on the plain (see `react.ts`) ReAct
 * implementation. Mostly meant as an illustration.
 *
 * See `react-with-slot.ts` for a more elegant implementation.
 */

// A URL to a repository containing various saved breadboard layouts.
const REPO_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs";

// The single node where all the important keys come from.
const secrets = kit.secrets(["API_KEY, GOOGLE_CSE_ID"]);

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
  .wire("<-API_KEY.", secrets);

// Wire up the math tool by including the `math.json` graph.
const math = board
  .include(`${REPO_URL}/math.json`)
  .wire("text->Observation", context);

// Wire up the search tool by including the `search-summarize.ts` graph.
const search = board
  .include(`${REPO_URL}/search-summarize.json`)
  .wire("text->Observation", context);

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
                .wire("search->text", search)
                .wire("math->text", math)
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
