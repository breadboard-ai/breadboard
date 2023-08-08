/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, BreadboardNode } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { readFile, writeFile } from "fs/promises";

const board = new Board();
const kit = board.addKit(Starter);

const makeTemplate = async (
  board: Board,
  kit: Starter
): Promise<BreadboardNode> => {
  const text = await readFile("./prompts/prompt-template.txt", "utf-8");
  const template = kit.promptTemplate(text, { $id: "bot-prompt" });

  // For now, just read them as static files.
  const readPart = async (name: string) => {
    const part = await readFile(`./prompts/${name}.txt`, "utf-8");
    template.wire(`<-${name}`, board.passthrough({ [name]: part, $id: name }));
  };

  await Promise.all(
    ["modifier_list", "hours", "menu", "prices", "modifiers", "moves"].map(
      (name) => readPart(name)
    )
  );

  return template;
};

const template = await makeTemplate(board, kit);
board.input().wire("user->", template.wire("prompt->", board.output()));

await writeFile("./graphs/coffee-bot.json", JSON.stringify(board, null, 2));

await writeFile(
  "./docs/coffee-bot.md",
  `# Coffee Bot\n\n\`\`\`mermaid\n${board.mermaid()}\n\`\`\``
);

const result = await board.runOnce({
  user: "I'd like a latte",
});

console.log(result);
