/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  NodeHandler,
  NodeHandlerFunction,
  NodeHandlers,
} from "@google-labs/graph-runner";
import type { NodeHandlerContext } from "./types.js";
import lambda from "./nodes/lambda.js";
import passthrough from "./nodes/passthrough.js";
import reflect from "./nodes/reflect.js";
import importHandler from "./nodes/import.js";
import invoke from "./nodes/invoke.js";
import include from "./nodes/include.js";
import slot from "./nodes/slot.js";

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
  handlers: NodeHandlers<NodeHandlerContext>;

  constructor() {
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
  slot = slot;
}
