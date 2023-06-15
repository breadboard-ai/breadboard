/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, NodeHandlers, follow } from "./graph.js";

const graph: GraphDescriptor = {
  edges: [
    {
      entry: true,
      from: { node: "user-input", output: "text" },
      to: { node: "text-completion", input: "text" },
    },
    {
      from: { node: "text-completion", output: "completion" },
      to: { node: "console-output", input: "text" },
    },
  ],
  nodes: [
    { id: "user-input", type: "user-input", outputs: ["text"], inputs: [] },
    {
      id: "text-completion",
      type: "text-completion",
      inputs: ["text"],
      outputs: ["completion"],
    },
    {
      id: "console-output",
      type: "console-output",
      inputs: ["text"],
      outputs: [],
    },
  ],
};

const handlers: NodeHandlers = {
  "user-input": (inputs) => {
    console.log("User input handler invoked with inputs:", inputs);
    return {
      text: "this is a real user input",
    };
  },
  "text-completion": (inputs) => {
    console.log("Text completion handler invoked with inputs:", inputs);
    return {
      completion: "this is a real text completion",
    };
  },
  "console-output": (inputs) => {
    console.log("Console output handler invoked with inputs:", inputs);
    return {};
  },
};

follow(graph, handlers);
