/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { config } from "dotenv";
import { memoryPatternTwo } from "./memory-pattern.js";

config();

const board = new Board();
const kit = board.addKit(Starter);

const palm_key = kit.secrets(["PALM_KEY"]);

// Store Friedrich's template so that we can refer back to it to create a
// conversation loop.
const friedrich = kit.promptTemplate(
  "Add a single argument to a debate between a philosopher named Friedrich and a scientist named Albert. You are Friedrich, and you are disagreeable, brooding, skeptical, sarcastic, yet passionate about uncovering new insights with Albert. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating.\n\n== Conversation Transcript\n{{memory}}\n\n==Additional Single Argument\nFriedrich:"
);

const albert = kit.promptTemplate(
  'Add a single argument to a debate between a scientist named Albert and a philosopher named Friedrich. You are Albert, and you are warm, funny, inquisitve, and passionate about uncovering new insights with Friedrich. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating."\n\n== Debate History\n{{memory}}\n\n==Additional Single Argument\n\nAlbert:',
  { $id: "albert" }
);

const {
  first: rememberQuestion,
  second: rememberAlbert,
  third: rememberFriedrich,
} = memoryPatternTwo(kit, albert, friedrich);

albert.wire(
  "prompt->text",
  kit
    .generateText({
      stopSequences: ["\nFriedrich", "\n**Friedrich"],
    })
    .wire("completion->Albert", rememberAlbert)
    .wire("completion->text", board.output())
    .wire("<-PALM_KEY.", palm_key)
);

friedrich.wire(
  "prompt->text",
  kit
    .generateText({
      stopSequences: ["\nAlbert", "\n**Albert"],
    })
    .wire("completion->Friedrich", rememberFriedrich)
    .wire("completion->text", board.output())
    .wire("<-PALM_KEY.", palm_key)
);

board
  .input("What is the topic of the debate?")
  .wire("text->topic", rememberQuestion);

for await (const stop of board.run()) {
  if (stop.type === "input") {
    stop.inputs = { text: "Weather in California" };
  } else if (stop.type === "output") {
    console.log(stop.outputs.text);
  }
}
