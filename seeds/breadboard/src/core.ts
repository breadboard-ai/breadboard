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
  NodeHandlerContext,
  SlotNodeInputs,
} from "./types.js";
import { Board } from "./board.js";
import lambda from "./nodes/lambda.js";
import passthrough from "./nodes/passthrough.js";
import reflect from "./nodes/reflect.js";
import importHandler from "./nodes/import.js";
import invoke from "./nodes/invoke.js";
import include from "./nodes/include.js";

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
  import = importHandler;
  invoke = invoke;
  include = include;

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
