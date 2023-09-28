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
} from "@google-labs/graph-runner";
import { Starter } from "@google-labs/llm-starter";

export class Receiver {
  board: Board;
  handlers?: NodeHandlers;

  constructor() {
    this.board = new Board();
    this.board.addKit(Starter);
  }

  async handle(nodeType: NodeTypeIdentifier, inputs: InputValues) {
    if (!this.handlers)
      this.handlers = await Board.handlersFromBoard(this.board);
    const handler = this.handlers[nodeType];
    if (!handler)
      throw new Error(`No handler found for node type "${nodeType}".`);
    return await handler(inputs);
  }
}
