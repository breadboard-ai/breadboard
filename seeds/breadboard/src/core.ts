/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeHandlers, NodeHandlerContext } from "./types.js";
import lambda from "./nodes/lambda.js";
import passthrough from "./nodes/passthrough.js";
import reflect from "./nodes/reflect.js";
import importHandler from "./nodes/import.js";
import invoke from "./nodes/invoke.js";
import include from "./nodes/include.js";
import slot from "./nodes/slot.js";

export class Core {
  handlers: NodeHandlers<NodeHandlerContext>;

  constructor() {
    this.handlers = {
      lambda,
      passthrough,
      reflect,
      import: importHandler,
      invoke,
      include,
      slot,
    };
  }
}
