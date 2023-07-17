/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board();
const kit = board.addKit(Starter);

const memory = kit.localMemory();

const api_key = kit.secrets(["API_KEY"]);

// Store Friedrich's template so that we can refer back to it to create a
// conversation loop.
const friedrich = kit.textTemplate(
  "Add a single argument to a debate between a philosopher named Friedrich and a scientist named Albert. You are Friedrich, and you are disagreeable, brooding, skeptical, sarcastic, yet passionate about uncovering new insights with Albert. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating.\n\n== Conversation Transcript\n{{context}}\n\n==Additional Single Argument\nFriedrich:"
);

const albert = kit
  .textTemplate(
    'Add a single argument to a debate between a scientist named Albert and a philosopher named Friedrich. You are Albert, and you are warm, funny, inquisitve, and passionate about uncovering new insights with Friedrich. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating."\n\n== Debate History\n{{context}}\n\n==Additional Single Argument\n\nAlbert:',
    { $id: "albert" }
  )
  .wire(
    "prompt->text",
    kit
      .textCompletion({
        "stop-sequences": ["\nFriedrich", "\n**Friedrich"],
      })
      .wire("completion->Albert", kit.localMemory().wire("context", friedrich))
      .wire(
        "completion->context",
        kit
          .textTemplate(
            "Restate the paragraph below in the voice of a brillant 20th century scientist. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
            { $id: "albert-voice" }
          )
          .wire(
            "prompt->text",
            kit
              .textCompletion()
              .wire("<-API_KEY.", api_key)
              .wire("completion->text", board.output())
          )
      )
      .wire("<-API_KEY.", api_key)
  );

friedrich.wire(
  "prompt->text",
  kit
    .textCompletion({
      "stop-sequences": ["\nAlbert", "\n**Albert"],
    })
    .wire("completion->Friedrich", kit.localMemory().wire("context", albert))
    .wire(
      "completion->context",
      kit
        .textTemplate(
          "Restate the paragraph below in the voice of a 19th century philosopher. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
          { $id: "friedrich-voice" }
        )
        .wire(
          "prompt->text",
          kit
            .textCompletion()
            .wire("<-API_KEY.", api_key)
            .wire("completion->text", board.output())
        )
    )
    .wire("<-API_KEY.", api_key)
);

board
  .input("What is the topic of the debate?")
  .wire("text->topic", memory.wire("context->", albert));

export default board;
