/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeHandler,
  NodeHandlerFunction,
  NodeHandlers,
  OutputValues,
} from "@google-labs/graph-runner";
import type {
  BreadboardSlotSpec,
  BreadboardValidator,
  BreadboardCapability,
  NodeHandlerContext,
  LambdaNodeOutputs,
  ImportNodeInputs,
  IncludeNodeInputs,
  SlotNodeInputs,
} from "./types.js";
import { Board } from "./board.js";
import lambda from "./nodes/lambda.js";
import passthrough from "./nodes/passthrough.js";
import reflect from "./nodes/reflect.js";

const CORE_HANDLERS = [
  "lambda",
  "import",
  "include",
  "invoke",
  "reflect",
  "slot",
  "passthrough",
];

export class Core {
  #slots: BreadboardSlotSpec;
  #validators: BreadboardValidator[];
  handlers: NodeHandlers<NodeHandlerContext>;

  constructor(slots: BreadboardSlotSpec, validators: BreadboardValidator[]) {
    this.#slots = slots;
    this.#validators = validators;
    this.handlers = CORE_HANDLERS.reduce((handlers, type) => {
      const that = this as unknown as Record<
        string,
        NodeHandler<NodeHandlerContext>
      >;
      handlers[type] = (
        that[type] as NodeHandlerFunction<NodeHandlerContext>
      ).bind(this);
      return handlers;
    }, {} as NodeHandlers<NodeHandlerContext>);
  }

  lambda = lambda;
  passthrough = passthrough;
  reflect = reflect;

  async import(
    inputs: ImportNodeInputs,
    context: NodeHandlerContext
  ): Promise<LambdaNodeOutputs> {
    const { path, $ref, graph, ...args } = inputs;

    // TODO: Please fix the $ref/path mess.
    const source = path || $ref || "";
    const board = graph
      ? (graph as Board).runOnce // TODO: Hack! Use JSON schema or so instead.
        ? ({ ...graph } as Board)
        : await Board.fromGraphDescriptor(graph)
      : await Board.load(source, {
          base: context.board.url,
          outerGraph: context.parent,
        });
    board.args = args;

    return { board: { kind: "board", board } as BreadboardCapability };
  }

  async invoke(
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> {
    const { path, board, graph, ...args } = inputs as IncludeNodeInputs;

    const runnableBoard = board
      ? await Board.fromBreadboardCapability(board)
      : graph
      ? await Board.fromGraphDescriptor(graph)
      : path
      ? await Board.load(path, {
          base: context.board.url,
          outerGraph: context.parent,
        })
      : undefined;

    if (!runnableBoard) throw new Error("No board provided");

    return await runnableBoard.runOnce(args, context);
  }

  async include(
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> {
    const { path, $ref, board, graph, slotted, ...args } =
      inputs as IncludeNodeInputs;

    // Add the current graph's URL as the url of the slotted graph,
    // if there isn't an URL already.
    const slottedWithUrls: BreadboardSlotSpec = {};
    if (slotted) {
      for (const key in slotted) {
        slottedWithUrls[key] = { url: context.board.url, ...slotted[key] };
      }
    }

    // TODO: Please fix the $ref/path mess.
    const source = path || $ref || "";

    const runnableBoard = board
      ? await Board.fromBreadboardCapability(board)
      : graph
      ? await Board.fromGraphDescriptor(graph)
      : await Board.load(source, {
          slotted: slottedWithUrls,
          base: context.board.url,
          outerGraph: context.parent,
        });

    return await runnableBoard.runOnce(args, context);
  }

  async slot(
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> {
    const { slot, ...args } = inputs as SlotNodeInputs;
    if (!slot) throw new Error("To use a slot, we need to specify its name");
    const graph = this.#slots[slot];
    if (!graph) throw new Error(`No graph found for slot "${slot}"`);
    const slottedBreadboard = await Board.fromGraphDescriptor(graph);
    return await slottedBreadboard.runOnce(args, context);
  }
}
