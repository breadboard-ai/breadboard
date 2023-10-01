/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import {
  InputValues,
  NodeHandlers,
  NodeTypeIdentifier,
  OutputValues,
} from "@google-labs/graph-runner";
import { Starter } from "@google-labs/llm-starter";

/**
 * This receiver is intentionally hacky. A real implementation would
 * also need to pick and choose carefully which requests to execute and how.
 * This is just an illustration of how this might be done.
 */
export class ProxyReceiver {
  board: Board;
  handlers?: NodeHandlers;

  constructor() {
    this.board = new Board();
    this.board.addKit(Starter);
  }

  async handle(nodeType: NodeTypeIdentifier, inputs: InputValues) {
    if (!this.handlers)
      this.handlers = await Board.handlersFromBoard(this.board);
    if (nodeType === "secrets") {
      const { keys } = inputs as { keys: string[] };
      return keys.reduce((acc, key) => {
        acc[key] = key;
        return acc;
      }, {} as OutputValues);
    } else if (nodeType === "generateText") {
      inputs.PALM_KEY = window.localStorage.getItem("PALM_KEY") || "";
    }
    const handler = this.handlers[nodeType];
    if (!handler)
      throw new Error(`No handler found for node type "${nodeType}".`);
    return await handler(inputs);
  }
}
