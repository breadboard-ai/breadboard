/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile } from "fs/promises";

import { intro, log, text, outro } from "@clack/prompts";
import { config } from "dotenv";

import { Board, LogProbe } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { Template } from "./template.js";

config();

const board = new Board();
const kit = board.addKit(Starter);

const template = new Template("v2-multi-agent", board, kit);
const prompt = await template.loadTemplate("order-agent.txt");
await template.wirePart("tools", "json");
await template.wirePart("format", "json");

const customerMemory = kit.append({ $id: "customerMemory" });
const agentMemory = kit.append({ $id: "agentMemory" });
const toolMemory = kit.append({ $id: "toolMemory" });

board.passthrough({ accumulator: "\n" }).wire("accumulator->", customerMemory);
customerMemory.wire("accumulator->", agentMemory);
agentMemory.wire("accumulator->", toolMemory);
agentMemory.wire("accumulator->", customerMemory);
toolMemory.wire("accumulator->", agentMemory);

toolMemory.wire("accumulator->bot", board.output());

prompt
  .wire("memory<-accumulator", customerMemory)
  .wire("memory<-accumulator", toolMemory);

function checkMenu({ actionInput }: { actionInput: string }) {
  // Hard-code the output for now.
  return {
    name: "checkMenu",
    result: {
      item: "Chai Latte",
      modifiers: [],
    },
  };
}

const checkMenuTool = kit
  .runJavascript("checkMenu", {
    $id: "checkMenu",
    code: checkMenu.toString(),
  })
  .wire("result->Tool", toolMemory);

function route({ completion }: { completion: string }) {
  const data = JSON.parse(completion);
  console.log("data", data);
  return { [data.action]: data };
}

const toolRouter = kit
  .runJavascript("route", {
    $id: "toolRouter",
    code: route.toString(),
    raw: true,
  })
  .wire("customer->bot", board.output())
  .wire(
    "customer->json",
    kit
      .jsonata("actionInput")
      .wire(
        "result->message",
        board.input().wire("customer->Customer", customerMemory)
      )
  )
  .wire("checkMenu->", checkMenuTool);

board.input().wire("customer->Customer", customerMemory);

prompt.wire(
  "prompt->text",
  kit
    .generateText({
      stopSequences: ["\nTool", "\nCustomer"],
      safetySettings: [
        {
          category: "HARM_CATEGORY_DEROGATORY",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    })
    .wire("completion->", toolRouter)
    .wire("completion->Agent", agentMemory)
    .wire("filters->", board.output({ $id: "blocked" }))
    .wire("<-PALM_KEY.", kit.secrets(["PALM_KEY"]))
);

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
