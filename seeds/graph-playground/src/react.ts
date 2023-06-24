/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// https://regex101.com/r/1ULtj6/1
const COMPLETION_REGEX =
  /(?:.*)(?:\nAction:\W+)(.+)(?:\nAction Input\W+)(.*)/gms;

export class ReActHelper {
  tools = {
    search:
      "Useful for when you need to find facts. Input should be a search query.",
    math: "Useful for when you need to solve math problems. Input should be a math problem to be solved.",
  };

  async getTools() {
    return {
      tools: Object.keys(this.tools).join(", "),
    };
  }

  async getToolDescriptions() {
    return {
      descriptions: Object.entries(this.tools)
        .map(([name, description]) => `${name}: ${description}`)
        .join("\n"),
    };
  }

  async parseCompletion(completion: string) {
    const matchAction = COMPLETION_REGEX.exec(completion);
    // TODO: Match final answer, obvs.
    if (!matchAction) throw new Error("No action found in completion");
    const action = matchAction[1].trim();
    const input = matchAction[2].trim();
    return {
      [action]: input,
    };
  }
}
