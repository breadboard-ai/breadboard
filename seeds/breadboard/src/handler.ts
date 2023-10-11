/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues, NodeHandler } from "@google-labs/graph-runner";

export const callHandler = async <T>(
  handler: NodeHandler<T>,
  inputs: InputValues,
  context?: T
) => {
  if (handler instanceof Function) return handler(inputs, context);
  if (handler.invoke) return handler.invoke(inputs, context);
};
