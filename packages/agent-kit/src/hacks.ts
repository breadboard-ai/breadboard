/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeDescriberFunction,
  NodeHandler,
  Schema,
} from "@google-labs/breadboard";

// This is where we hack on making kit do the thing we want
// TODO: Shape this and move it to the right place

export const workerDescriber: NodeDescriberFunction = async (
  inputs?: InputValues,
  inputSchema?: Schema,
  outputSchema?: Schema
) => {
  return {
    // TODO: Convey the actual schema for the worker node.
    inputSchema: {
      type: "object",
      properties: {
        foo: {
          type: "string",
          title: "Foo",
          description: "The foo input",
        },
      },
    },
    outputSchema: {},
  };
};

export const addDescriber = (
  handler: NodeHandler,
  describer: NodeDescriberFunction
) => {
  if (typeof handler === "function") {
    handler = { invoke: handler };
  }
  return { invoke: handler.invoke, describe: describer } as NodeHandler;
};
