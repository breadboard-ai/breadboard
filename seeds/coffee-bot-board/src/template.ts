/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Board,
  BreadboardNode,
  OptionalIdConfiguration,
} from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";
import { readFile, readdir } from "fs/promises";

type Example = {
  customer: string;
  bot: unknown;
};

export class PromptLoader {
  path: string;
  constructor(base: string) {
    this.path = `./prompts/${base}`;
  }

  async load(filename: string, extension: string) {
    return await readFile(`${this.path}/${filename}.${extension}`, "utf-8");
  }
}

export class PromptMaker {
  loader: PromptLoader;

  constructor(base: string) {
    this.loader = new PromptLoader(base);
  }

  async prompt(
    filename: string,
    id: string
  ): Promise<[string, OptionalIdConfiguration]> {
    return [await this.loader.load(filename, "txt"), { $id: id }];
  }

  async part(name: string, extension: string) {
    const text = await this.loader.load(name, extension);
    return { [name]: text, $id: name };
  }

  async jsonPart(name: string) {
    const text = await this.loader.load(name, "json");
    return { [name]: JSON.parse(text), $id: name };
  }
}

type TemplateNodeType = BreadboardNode<unknown, unknown>;

/**
 * @deprecated don't use this class, use PromptMaker instead
 */
export class Template {
  path: string;
  textPrompt?: TemplateNodeType;

  constructor(
    version: string,
    public board: Board,
    public kit: Starter,
    public core: Core
  ) {
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

  async wireExamples(template: TemplateNodeType): Promise<TemplateNodeType> {
    const files = (await readdir(`${this.path}/examples`)).filter((filename) =>
      filename.endsWith(".json")
    );
    files.sort();
    const examples = await Promise.all(files.map(this.readExample.bind(this)));
    const text = examples.join("\n\n");
    template.wire(
      "<-examples",
      this.core.passthrough({ examples: text, $id: "examples" })
    );
    return template;
  }

  async loadTemplate(filename: string): Promise<TemplateNodeType> {
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
      this.core.passthrough({ [name]: part, $id: name })
    );
  }

  async make(): Promise<TemplateNodeType> {
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
