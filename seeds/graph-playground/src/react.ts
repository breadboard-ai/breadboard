/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
        .join("\n\n"),
    };
  }

  async parseCompletion(completion: string) {
    const lines = completion.split("\n");
    if (lines.length < 2) {
      throw new Error(`Unparsable ReAct completion: ${completion}`);
    }
    if (lines[1].startsWith("Action:")) {
      // action
      const action = lines[1].replace("Action:", "").trim();
      const input = lines[2].replace("Action Input:", "").trim();
      return { [action]: input };
    } else if (lines[1].startsWith("Final Answer:")) {
      // answer
      const answer = lines[1].replace("Final Answer:", "").trim();
      return { answer };
    }
    throw new Error(`Unparsable ReAct completion: ${completion}`);
  }
}
