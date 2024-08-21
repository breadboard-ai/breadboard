/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The logic in this file is mostly old thinking and shouldn't be replicated.
// It's here as a historical artifact.
// See `call-react-with-slot.ts` for the new thinking.

import {
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
  type InputValues,
  type NodeHandlers,
} from "@google-labs/breadboard";

const tools = {
  search:
    "Useful for when you need to find facts. Input should be a search query.",
  math: "Useful for when you need to solve math problems. Input should be a math problem to be solved.",
};

type ParseCompletionInputs = {
  completion: string;
};

const handlers = {
  getTools: async () => ({
    tools: Object.keys(tools).join(", "),
  }),
  getDescriptions: async () => ({
    descriptions: Object.entries(tools)
      .map(([name, description]) => `${name}: ${description}`)
      .join("\n\n"),
  }),
  parseCompletion: async (inputs: InputValues) => {
    const { completion } = inputs as ParseCompletionInputs;
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
  },
};

export class ReActHelper implements Kit {
  // It's a local module, so report "." as Kit's url.
  // TODO: Remove the need to do so manually. Every kit without a URL is a
  // local Kit.
  url = ".";

  #handlers: NodeHandlers;
  #nodeFactory: NodeFactory;

  constructor(nodeFactory: NodeFactory) {
    this.#handlers = handlers;
    this.#nodeFactory = nodeFactory;
  }

  get handlers() {
    return this.#handlers;
  }

  getTools(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create(this, "getTools", rest, $id);
  }

  getDescriptions(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create(this, "getDescriptions", rest, $id);
  }

  parseCompletion(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create(this, "parseCompletion", { ...rest }, $id);
  }
}
