/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile } from "fs/promises";

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { config } from "dotenv";
import { Template } from "./template.js";

config();

const board = new Board();
const kit = board.addKit(Starter);

const template = new Template("v2-multi-agent", board, kit);
const prompt = await template.loadTemplate("order-agent.txt");
await template.wirePart("tools", "json");
await template.wirePart("format", "json");

function route({ completion }: { completion: string }) {
  const data = JSON.parse(completion);
  return { [data.action]: data };
}

const toolRouter = kit
  .runJavascript("route", {
    code: route.toString(),
    raw: true,
  })
  .wire("customer->", board.output());

board.input().wire(
  "customer->",
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
      .wire("filters->", board.output({ $id: "blocked" }))
      .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
  )
);

await writeFile("./graphs/coffee-bot-v2.json", JSON.stringify(board, null, 2));

await writeFile(
  "./docs/coffee-bot-v2.md",
  `# Coffee Bot\n\n\`\`\`mermaid\n${board.mermaid()}\n\`\`\``
);

const result = await board.runOnce({
  customer: "I'd like a chai latte",
});

console.log(result);
