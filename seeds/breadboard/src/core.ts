/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type GraphDescriptor,
  type GraphTraversalContext,
  type InputValues,
  type NodeHandler,
  type NodeHandlers,
  type OutputValues,
} from "@google-labs/graph-runner";
import type { Breadboard, ContextProvider, Kit, NodeFactory } from "./types.js";
import { Board, BreadboardSlotSpec } from "./board.js";

const CORE_HANDLERS = ["input", "output", "include", "reflect", "slot"];

type SlotInput = {
  slot: string;
  args: InputValues;
};

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
};

export class Core implements Kit {
  #board?: Breadboard;
  #contextProvider?: ContextProvider;
  handlers: NodeHandlers;
  #outputs: OutputValues = {};

  constructor(_nodeFactory: NodeFactory) {
    this.handlers = CORE_HANDLERS.reduce((handlers, type) => {
      const that = this as unknown as Record<string, NodeHandler>;
      handlers[type] = that[type].bind(this);
      return handlers;
    }, {} as NodeHandlers);
  }

  init(board: Breadboard, contextProvider: ContextProvider) {
    this.#board = board;
    this.#contextProvider = contextProvider;
  }

  async input(
    _ctx: GraphTraversalContext,
    inputs: InputValues
  ): Promise<OutputValues> {
    const { message } = inputs as { message: string };
    this.#board?.dispatchEvent(
      new CustomEvent("input", {
        detail: message,
      })
    );
    return this.#contextProvider?.getInputs() as OutputValues;
  }

  async output(
    _ctx: GraphTraversalContext,
    inputs: InputValues
  ): Promise<void> {
    this.#board?.dispatchEvent(
      new CustomEvent("output", {
        detail: inputs,
      })
    );
    this.#outputs = inputs;
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
    let outputs: OutputValues = {};
    board.addInputs(args);
    board.on("output", (event) => {
      const { detail } = event as CustomEvent;
      outputs = detail;
    });
    await board.run();
    return outputs;
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
    const graph = this.#contextProvider?.getSlotted()[slot];
    if (!graph) throw new Error(`No graph found for slot ${slot}`);
    const slottedBreadboard = Board.fromGraphDescriptor(graph);
    let outputs: OutputValues = {};
    slottedBreadboard.addInputs(args);
    slottedBreadboard.on("output", (event) => {
      const { detail } = event as CustomEvent;
      outputs = detail;
    });
    await slottedBreadboard.run();
    return outputs;
  }
}
