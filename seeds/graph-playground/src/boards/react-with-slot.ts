/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board();
const kit = board.addKit(Starter);

/**
 * This final form of the  ReAct
 * implementation, building on `react-with-jsonata.ts`.
 *
 * This board actually incomplete: it contains an empty slot that is
 * filled in later.
 *
 * This slot is where tools are added into the board. This way,
 * people can start with this same ReAct board and add their own
 * tools without modifying it.
 *
 * See `call-react-with-slot.ts` for an example of how this slot is filled.
 */

// The single node where all the important keys come from.
const secrets = kit.secrets(["API_KEY", "GOOGLE_CSE_ID"]);

// This is the context that ReAct algo accumulates.
const context = kit.localMemory();

const reflectionSlot = board.slot({
  $id: "get-slot",
  slot: "tools",
  graph: true,
});

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

reflectionSlot.wire("graph->json", tools).wire("graph->json", descriptions);

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
  .wire("descriptions<-result.", descriptions)
  .wire("tools<-result.", tools)
  .wire("memory<-context", context);

// The completion must include stop sentences, to prevent LLM form hallucinating
// all answers.
const reActCompletion = kit
  .textCompletion({
    "stop-sequences": ["\nObservation"],
    $id: "react-completion",
  })
  .wire("<-API_KEY.", secrets);

board.input("Ask ReAct a question").wire(
  "text->Question",
  kit.localMemory({ $id: "remember-question" }).wire(
    "context->memory",
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
            // Instead of wiring tools directly, we create a slot for them.
            .wire(
              "*->",
              board
                .slot({
                  $id: "tools-slot",
                  slot: "tools",
                })
                .wire("text->Observation", context)
            )
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
