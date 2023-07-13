/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Kit, NodeFactory } from "@google-labs/breadboard";
import {
  InputValues,
  NodeHandlers,
  OutputValues,
} from "@google-labs/graph-runner";

type Helper = Record<string, (...args: string[]) => Promise<OutputValues>>;

export class ReActHelper implements Kit {
  handlers: NodeHandlers;

  constructor(_nodeFactory: NodeFactory) {
    this.handlers = {
      "react-helper": async (inputs: InputValues) => {
        const manager = this as unknown as Helper;
        const method = inputs["method"] as string;
        if (!method) throw new Error("Custom node requires `method` input");
        const argNames = (inputs["args"] ?? []) as string[];
        const args = argNames.map((argName) => inputs[argName] as string);
        return await manager[method](...args);
      },
    };
  }

  tools = {
    search:
      "Useful for when you need to find facts. Input should be a search query.",
    math: "Useful for when you need to solve math problems. Input should be a math problem to be solved.",
  };

  async getToolsObject() {
    return {
      tools: this.tools,
    };
  }

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
