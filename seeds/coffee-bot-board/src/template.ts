/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, BreadboardNode } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { readFile, readdir } from "fs/promises";

type Example = {
  customer: string;
  bot: unknown;
};

export class Template {
  path: string;
  textPrompt?: BreadboardNode;

  constructor(version: string, public board: Board, public kit: Starter) {
    this.path = `./prompts/${version}`;
  }

  async readExample(filename: string, index: number) {
    const json = await readFile(`${this.path}/examples/${filename}`, "utf-8");
    const examples = JSON.parse(json);
    const text = examples
      .map(
        (example: Example) =>
          `==\nCustomer: ${example.customer}Response:\n${JSON.stringify(
            example.bot,
            null,
            2
          )}==`
      )
      .join("\n");
    return `\nExample ${index + 1}\n${text}`;
  }

  async wireExamples(template: BreadboardNode): Promise<BreadboardNode> {
    const files = (await readdir(`${this.path}/examples`)).filter((filename) =>
      filename.endsWith(".json")
    );
    files.sort();
    const examples = await Promise.all(files.map(this.readExample.bind(this)));
    const text = examples.join("\n\n");
    template.wire(
      "<-examples",
      this.board.passthrough({ examples: text, $id: "examples" })
    );
    return template;
  }

  async loadTemplate(filename: string) {
    const { kit } = this;
    const text = await readFile(`${this.path}/${filename}`, "utf-8");
    this.textPrompt = kit.promptTemplate(text, { $id: "bot-prompt" });
    return this.textPrompt;
  }

  async wirePart(name: string, extension: string) {
    if (!this.textPrompt) throw new Error("Must load template first");
    const part = await readFile(`${this.path}/${name}.${extension}`, "utf-8");
    this.textPrompt.wire(
      `<-${name}.`,
      this.board.passthrough({ [name]: part, $id: name })
    );
  }

  async make(): Promise<BreadboardNode> {
    const template = await this.loadTemplate("prompt-template.txt");

    // For now, just read them as static files.
    await Promise.all(
      ["modifier_list", "hours", "menu", "prices", "modifiers", "moves"].map(
        (name) => this.wirePart(name, "txt")
      )
    );

    await Promise.all(["format"].map((name) => this.wirePart(name, "json")));

    await this.wireExamples(template);

    return template;
  }
}
