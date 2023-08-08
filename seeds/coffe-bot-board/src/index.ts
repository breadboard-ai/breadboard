/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, writeFile } from "fs/promises";

import { Board, BreadboardNode } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { config } from "dotenv";

config();

const board = new Board();
const kit = board.addKit(Starter);

const makeTemplate = async (
  board: Board,
  kit: Starter
): Promise<BreadboardNode> => {
  const text = await readFile("./prompts/prompt-template.txt", "utf-8");
  const template = kit.promptTemplate(text, { $id: "bot-prompt" });

  // For now, just read them as static files.
  const readPart = async (name: string, extension: string) => {
    const part = await readFile(`./prompts/${name}.${extension}`, "utf-8");
    template.wire(`<-${name}`, board.passthrough({ [name]: part, $id: name }));
  };

  await Promise.all(
    ["modifier_list", "hours", "menu", "prices", "modifiers", "moves"].map(
      (name) => readPart(name, "txt")
    )
  );

  await Promise.all(["format"].map((name) => readPart(name, "json")));

  return template;
};

const template = await makeTemplate(board, kit);
board.input().wire(
  "user->",
  template.wire(
    "prompt->text",
    kit
      .generateText({
        safetySettings: [
          {
            category: "HARM_CATEGORY_DEROGATORY",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      })
      .wire("completion->", board.output({ $id: "completion" }))
      .wire("filters->", board.output({ $id: "blocked" }))
      .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
  )
);

await writeFile("./graphs/coffee-bot.json", JSON.stringify(board, null, 2));

await writeFile(
  "./docs/coffee-bot.md",
  `# Coffee Bot\n\n\`\`\`mermaid\n${board.mermaid()}\n\`\`\``
);

const result = await board.runOnce({
  user: "I'd like a latte",
});

console.log(result);
