/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config } from "dotenv";

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

config();

const board = new Board();
const kit = board.addKit(Starter);

const input = board.input();
const output = board.output();
output.wire("->", input);

const history = kit.localMemory();
input.wire("say->user", history);

const completion = kit
  .textCompletion()
  .wire("completion->hear", output)
  .wire("completion->assistant", history)
  .wire("<-PALM_KEY.", kit.secrets(["PALM_KEY"]));

kit
  .textTemplate(
    "This is a conversation between a friendly assistant and their user.\n" +
      "You are the assistant and your job is to try to be helpful,\n" +
      "empathetic, and fun.\n\n" +
      "{{context}}\n\n" +
      "== Current Conversation\n" +
      "user: {{question}}\n" +
      "assistant:"
  )
  .wire("prompt->text", completion)
  .wire("question<-say", input)
  .wire("<-context", history)
  .wire("<-context", board.passthrough({ context: "== Conversation History" }));

board.passthrough().wire("->", input);

const ask = readline.createInterface({ input: stdin, output: stdout });
console.log("Hello! I'm your friendly assistant. How can I help you today?");
console.log("Type 'exit' to end conversation.");
for await (const stop of board.run()) {
  if (stop.seeksInputs) {
    const say = await ask.question("> ");
    if (say === "exit") break;
    stop.inputs = { say };
  } else {
    console.log(stop.outputs.hear);
  }
}
ask.close();
