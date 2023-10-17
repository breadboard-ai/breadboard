/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, NodeHandler, NodeHandlerContext } from "./types.js";

export const callHandler = async <T>(
  handler: NodeHandler,
  inputs: InputValues,
  context: NodeHandlerContext
) => {
  if (handler instanceof Function) return handler(inputs, context);
  if (handler.invoke) return handler.invoke(inputs, context);
};
