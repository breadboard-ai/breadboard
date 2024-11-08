/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, ImperativeGraph } from "@breadboard-ai/types";

export { isImperativeGraph, toDeclarativeGraph };

function isImperativeGraph(graph: unknown): graph is ImperativeGraph {
  return "main" in (graph as ImperativeGraph);
}
function toDeclarativeGraph(graph: ImperativeGraph): GraphDescriptor {
  const { main } = graph;
  const declarative = structuredClone(graph) as GraphDescriptor;
  delete declarative.main;
  declarative.nodes = [
    {
      id: "input",
      type: "input",
      metadata: {
        title: "Input",
      },
    },
    {
      id: "run-module",
      type: "runModule",
      configuration: {
        $module: main,
      },
      metadata: {
        title: `Run ${graph.title || '"main" Module'}`,
      },
    },
    {
      id: "output",
      type: "output",
      metadata: {
        title: "Output",
      },
    },
  ];
  declarative.edges = [
    {
      from: "input",
      to: "run-module",
      out: "*",
      in: "",
    },
    {
      from: "run-module",
      to: "output",
      out: "*",
      in: "",
    },
  ];
  return declarative;
}
