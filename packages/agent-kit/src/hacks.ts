/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeDescriberFunction, NodeHandler } from "@google-labs/breadboard";

// This is where we hack on making kit do the thing we want
// TODO: Shape this and move it to the right place

export const workerDescriber: NodeDescriberFunction = async () => {
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "string",
          title: "Context",
          description: "The context to use for the worker",
        },
        instruction: {
          type: "string",
          title: "Instruction",
          description:
            "The instruction we want to give to the worker so that shapes its character and orients it a bit toward the task we want to give it.",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "string",
          title: "Context",
          description:
            "The context after generation. Pass this to the next agent when chaining them together.",
        },
        text: {
          type: "string",
          title: "Text",
          description:
            "The output from the agent. Use this to just get the output without any previous context.",
        },
      },
    },
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
