/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  GraphTraversalContext,
  InputValues,
  NodeHandler,
  NodeHandlers,
  OutputValues,
} from "@google-labs/graph-runner";
import {
  type Breadboard,
  type ContextProvider,
  type BreadboardSlotSpec,
} from "./types.js";
import { Board } from "./board.js";

export const CORE_HANDLERS = ["include", "reflect", "slot"];

type SlotInput = {
  slot: string;
  args: InputValues;
};

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
};

export class Core {
  #board: Breadboard;
  #slots: BreadboardSlotSpec;
  #contextProvider: ContextProvider;
  handlers: NodeHandlers;
  #outputs: OutputValues = {};

  constructor(
    board: Breadboard,
    slots: BreadboardSlotSpec,
    contextProvider: ContextProvider
  ) {
    this.#board = board;
    this.#slots = slots;
    this.#contextProvider = contextProvider;
    this.handlers = CORE_HANDLERS.reduce((handlers, type) => {
      const that = this as unknown as Record<string, NodeHandler>;
      handlers[type] = that[type].bind(this);
      return handlers;
    }, {} as NodeHandlers);
  }

  async include(
    _ctx: GraphTraversalContext,
    inputs: InputValues
  ): Promise<OutputValues> {
    const { path, $ref, slotted, ...args } = inputs as {
      path?: string;
      $ref?: string;
      slotted?: BreadboardSlotSpec;
      args: InputValues;
    };
    // TODO: Please fix the $ref/path mess.
    const board = await Board.load(path || $ref || "", slotted);
    return await board.runOnce(args);
  }

  async reflect(
    _ctx: GraphTraversalContext,
    _inputs: InputValues
  ): Promise<OutputValues> {
    const graph = deepCopy(this.#board as GraphDescriptor);
    return { graph };
  }

  async slot(
    _ctx: GraphTraversalContext,
    inputs: InputValues
  ): Promise<OutputValues> {
    const { slot, ...args } = inputs as SlotInput;
    if (!slot) throw new Error("To use a slot, we need to specify its name");
    const graph = this.#slots[slot];
    if (!graph) throw new Error(`No graph found for slot ${slot}`);
    const slottedBreadboard = Board.fromGraphDescriptor(graph);
    return await slottedBreadboard.runOnce(args);
  }
}
