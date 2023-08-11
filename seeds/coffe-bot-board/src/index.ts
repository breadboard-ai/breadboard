/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile } from "fs/promises";

import { intro, log, text, outro } from "@clack/prompts";
import { config } from "dotenv";

import { LogProbe } from "@google-labs/breadboard";

import { orderAgent } from "./order-agent.js";

const board = orderAgent;

config();

await writeFile("./graphs/coffee-bot-v2.json", JSON.stringify(board, null, 2));

await writeFile(
  "./docs/coffee-bot-v2.md",
  `# Coffee Bot\n\n\`\`\`mermaid\n${board.mermaid()}\n\`\`\``
);

intro("Hi! I am coffee bot! What would you like to have today?");

const probe = process.argv.includes("-v") ? new LogProbe() : undefined;

const ask = async (inputs: Record<string, unknown>) => {
  const defaultValue = "<Exit>";
  const message = ((inputs && inputs.message) as string) || "Enter some text";
  const input = await text({
    message,
    defaultValue,
  });
  if (input === defaultValue) return { exit: true };
  return { customer: input };
};
const show = (outputs: Record<string, unknown>) => {
  const { bot } = outputs;
  if (typeof bot == "string") log.success(bot);
  else log.success(JSON.stringify(bot));
};

try {
  // Run the board until it finishes. This may run forever.
  for await (const stop of board.run(probe)) {
    if (stop.seeksInputs) {
      stop.inputs = await ask(stop.inputArguments);
    } else {
      show(stop.outputs);
    }
  }

  outro("Awesome work! Let's do this again sometime.");
} catch (e) {
  console.log(e);
  if (e instanceof Error) log.error(e.message);
  outro("Oh no! Something went wrong.");
}
