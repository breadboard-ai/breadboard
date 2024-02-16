/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, NodeHandler, inspect } from "@google-labs/breadboard";

// This is where we hack on making kit do the thing we want
// TODO: Shape this and move it to the right place

export const addDescriber = async (
  handler: NodeHandler,
  graph: GraphDescriptor
) => {
  if (typeof handler === "function") {
    handler = { invoke: handler };
  }
  const describerResult = await inspect(graph).describe();
  return {
    invoke: handler.invoke,
    describe: async () => describerResult,
  } as NodeHandler;
};
