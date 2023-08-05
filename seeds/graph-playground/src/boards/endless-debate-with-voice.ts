/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board();
const kit = board.addKit(Starter);

const rememberFriedrich = kit.append({ $id: "rememberFriedrich" });
const rememberAlbert = kit.append({ $id: "rememberAlbert" });
const rememberQuestion = kit.append({ $id: "rememberQuestion" });

rememberQuestion.wire("accumulator->", rememberAlbert);
rememberAlbert.wire("accumulator->", rememberFriedrich);
rememberFriedrich.wire("accumulator->", rememberAlbert);

const palm_key = kit.secrets(["PALM_KEY"]);

// Store Friedrich's template so that we can refer back to it to create a
// conversation loop.
const friedrich = kit.promptTemplate(
  "Add a single argument to a debate between a philosopher named Friedrich and a scientist named Albert. You are Friedrich, and you are disagreeable, brooding, skeptical, sarcastic, yet passionate about uncovering new insights with Albert. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating.\n\n== Conversation Transcript\n{{context}}\n\n==Additional Single Argument\nFriedrich:"
);

const albert = kit
  .promptTemplate(
    'Add a single argument to a debate between a scientist named Albert and a philosopher named Friedrich. You are Albert, and you are warm, funny, inquisitve, and passionate about uncovering new insights with Friedrich. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating."\n\n== Debate History\n{{context}}\n\n==Additional Single Argument\n\nAlbert:',
    { $id: "albert" }
  )
  .wire(
    "prompt->text",
    kit
      .generateText({
        "stop-sequences": ["\nFriedrich", "\n**Friedrich"],
      })
      .wire(
        "completion->Albert",
        rememberAlbert.wire("accumulator->context", friedrich)
      )
      .wire(
        "completion->context",
        kit
          .promptTemplate(
            "Restate the paragraph below in the voice of a brillant 20th century scientist. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
            { $id: "albert-voice" }
          )
          .wire(
            "prompt->text",
            kit
              .generateText()
              .wire("<-PALM_KEY.", palm_key)
              .wire("completion->text", board.output())
          )
      )
      .wire("<-PALM_KEY.", palm_key)
  );

friedrich.wire(
  "prompt->text",
  kit
    .generateText({
      "stop-sequences": ["\nAlbert", "\n**Albert"],
    })
    .wire(
      "completion->Friedrich",
      rememberFriedrich.wire("accumulator->context", albert)
    )
    .wire(
      "completion->context",
      kit
        .promptTemplate(
          "Restate the paragraph below in the voice of a 19th century philosopher. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
          { $id: "friedrich-voice" }
        )
        .wire(
          "prompt->text",
          kit
            .generateText()
            .wire("<-PALM_KEY.", palm_key)
            .wire("completion->text", board.output())
        )
    )
    .wire("<-PALM_KEY.", palm_key)
);

board
  .input("What is the topic of the debate?")
  .wire("text->topic", rememberQuestion.wire("accumulator->context", albert));

export default board;
