/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, BreadboardNode } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { readFile, readdir } from "fs/promises";

const readExample = async (filename: string) => {
  const json = await readFile(`./prompts/examples/${filename}`, "utf-8");
  const example = JSON.parse(json);
  return `Customer: ${example.customer}Response:\n${JSON.stringify(
    example.bot,
    null,
    2
  )}`;
};

const wireExamples = async (
  template: BreadboardNode,
  board: Board
): Promise<BreadboardNode> => {
  const files = (await readdir("./prompts/examples")).filter((filename) =>
    filename.endsWith(".json")
  );
  const examples = await Promise.all(files.map(readExample));
  const text = examples.join("\n\n");
  template.wire(
    "<-examples",
    board.passthrough({ examples: text, $id: "examples" })
  );
  return template;
};

export const makeTemplate = async (
  board: Board,
  kit: Starter
): Promise<BreadboardNode> => {
  const text = await readFile("./prompts/prompt-template.txt", "utf-8");
  const template = kit.promptTemplate(text, { $id: "bot-prompt" });

  // For now, just read them as static files.
  const wirePart = async (name: string, extension: string) => {
    const part = await readFile(`./prompts/${name}.${extension}`, "utf-8");
    template.wire(`<-${name}`, board.passthrough({ [name]: part, $id: name }));
  };

  await Promise.all(
    ["modifier_list", "hours", "menu", "prices", "modifiers", "moves"].map(
      (name) => wirePart(name, "txt")
    )
  );

  await Promise.all(["format"].map((name) => wirePart(name, "json")));

  await wireExamples(template, board);

  return template;
};
