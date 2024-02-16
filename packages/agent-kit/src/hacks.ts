/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeDescriberFunction, NodeHandler } from "@google-labs/breadboard";

// This is where we hack on making kit do the thing we want
// TODO: Shape this and move it to the right place

export const addDescriber = (
  handler: NodeHandler,
  describer: NodeDescriberFunction
) => {
  if (typeof handler === "function") {
    handler = { invoke: handler };
  }
  return { invoke: handler.invoke, describe: describer } as NodeHandler;
};
