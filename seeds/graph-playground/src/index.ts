/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, log, note, outro, text } from "@clack/prompts";
import { config } from "dotenv";

import { OutputValues, InputValues } from "@google-labs/graph-runner";
import { Board, type ProbeEvent } from "@google-labs/breadboard";

import { ReActHelper } from "./react.js";

// Parse arguments. Redo with a library once it gets more complex. Example:
// npm run dev graphs/simplest.json -- --validate-safety --log-safety-labels
const args = process.argv.slice(2);
const graph = args[0];
const validateSafety = args.includes("--validate-safety");
const logSafetyLabels = args.includes("--log-safety-labels");

// Load the environment variables from `.env` file.
// This is how the `secrets` node gets ahold of the keys.
config();

const ask = async (inputs: InputValues): Promise<OutputValues> => {
  const defaultValue = "<Exit>";
  const message = ((inputs && inputs.message) as string) || "Enter some text";
  const input = await text({
    message,
    defaultValue,
  });
  if (input === defaultValue) return { exit: true };
  return { text: input };
};

// Line-wrapping magic courtesy of
// https://stackoverflow.com/questions/14484787/wrap-text-in-javascript
// Wrap lines neatly for clack.
const wrap = (s: string) => {
  const cols = (process.stdout.columns || 80) - 10;
  return s.replace(
    new RegExp(`(?![^\\n]{1,${cols}}$)([^\\n]{1,${cols}})\\s`, "g"),
    "$1\n"
  );
};

const show = (outputs: OutputValues) => {
  const { text } = outputs;
  if (typeof text == "string") log.success(wrap(text));
  else log.success(JSON.stringify(text));
};

// Use Breadboard probe feature to create a nice note in CLI for
// every text completion.
const probe = new EventTarget();
probe.addEventListener("node", (event: Event) => {
  const { detail } = event as ProbeEvent;
  if (logSafetyLabels && detail.safetyLabel)
    note(
      `Safety label for ${detail.descriptor.id}: ${detail.safetyLabel}`,
      "safety"
    );
  if (detail.descriptor.type !== "text-completion") return;
  const value = (detail?.outputs?.completion as string) || "empty response";
  note(wrap(value), "text completion");
});

intro("Let's traverse a graph!");

// Load the board, specified in the command line.
const board = await Board.load(graph);

// Add a custom kit.
board.addKit(ReActHelper);

try {
  // Run the board until it finishes. This may run forever.
  for await (const result of board.run(probe, validateSafety)) {
    if (result.seeksInputs) {
      result.inputs = await ask(result.inputArguments);
    } else {
      show(result.outputs);
    }
  }

  outro("Awesome work! Let's do this again sometime.");
} catch (e) {
  if (e instanceof Error) log.error(e.message);
  outro("Oh no! Something went wrong.");
}
