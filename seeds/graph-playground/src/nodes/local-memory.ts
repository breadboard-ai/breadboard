/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphTraversalContext, InputValues } from "../types.js";

const context: string[] = [];

export default async (_cx: GraphTraversalContext, inputs: InputValues) => {
  Object.entries(inputs).forEach(([key, value]) => {
    context.push(`${key}: ${value}`);
  });
  // TODO: This is a hack to get around the fact that we don't have a way to
  //       exit the graph when it's cycling indefinitely.
  if (context.length > 10) return { exit: true };
  return { context: context.join("\n") };
};
