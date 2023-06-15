/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, follow } from "./graph.js";

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

follow(graph);
